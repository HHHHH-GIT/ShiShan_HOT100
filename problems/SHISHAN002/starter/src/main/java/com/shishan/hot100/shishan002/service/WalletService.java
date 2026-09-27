package com.shishan.hot100.shishan002.service;

import com.shishan.hot100.shishan002.cache.BalanceCache;
import com.shishan.hot100.shishan002.domain.BalanceChange;
import com.shishan.hot100.shishan002.domain.LedgerEntry;
import com.shishan.hot100.shishan002.exception.BusinessException;
import com.shishan.hot100.shishan002.repository.LedgerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class WalletService {

    private static final Logger logger = LoggerFactory.getLogger(WalletService.class);

    private static final int YUAN_SCALE = 3;

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final LedgerRepository ledgerRepository;

    private final BalanceCache balanceCache;

    private final RiskClient riskClient;

    public WalletService(LedgerRepository ledgerRepository, BalanceCache balanceCache, RiskClient riskClient) {
        this.ledgerRepository = ledgerRepository;
        this.balanceCache = balanceCache;
        this.riskClient = riskClient;
    }

    public BigDecimal getBalance(String playerId) {
        String key = cacheKey(playerId);
        BigDecimal cached = balanceCache.get(key);
        if (cached != null) {
            return cached;
        }
        long raw = ledgerRepository.getBalanceRaw(playerId);
        BigDecimal balance = UnitConverter.toYuan(raw).setScale(YUAN_SCALE, RoundingMode.HALF_UP);
        balanceCache.put(key, balance);
        return balance;
    }

    public BalanceChange recharge(String playerId, BigDecimal amount) {
        if (playerId == null || playerId.isBlank()) {
            throw new BusinessException(400, "玩家ID不能为空");
        }
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(400, "充值金额必须大于0");
        }
        BigDecimal yuan = amount.setScale(YUAN_SCALE, RoundingMode.HALF_UP);
        if (!ledgerRepository.exists(playerId)) {
            throw new BusinessException(404, "玩家不存在: " + playerId);
        }
        String key = cacheKey(playerId);

        balanceCache.evict(key);

        BigDecimal balanceBefore = riskClient.preCheck(playerId, yuan);

        BigDecimal cached = balanceCache.peek(key);
        if (cached != null) {
            logger.warn("STALE_CACHE: balance read refilled cache before ledger commit, key={}, refilled={}", key, cached);
        }

        credit(playerId, yuan, "RECHARGE");

        BigDecimal balanceAfter = balanceBefore.add(yuan).setScale(YUAN_SCALE, RoundingMode.HALF_UP);
        logger.info("充值成功: playerId={}, amount={}, balanceBefore={}, balanceAfter={}",
                playerId, yuan, balanceBefore, balanceAfter);
        return new BalanceChange(balanceBefore, balanceAfter);
    }

    public BalanceChange trade(String playerId, String side, BigDecimal amount, String bizId) {
        if (playerId == null || playerId.isBlank()) {
            throw new BusinessException(400, "玩家ID不能为空");
        }
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(400, "交易金额必须大于0");
        }
        if (!"BUY".equals(side) && !"SELL".equals(side)) {
            throw new BusinessException(400, "交易方向不合法: " + side);
        }
        BigDecimal yuan = amount.setScale(YUAN_SCALE, RoundingMode.HALF_UP);
        if (!ledgerRepository.exists(playerId)) {
            throw new BusinessException(404, "玩家不存在: " + playerId);
        }
        String key = cacheKey(playerId);

        BigDecimal balanceBefore = riskClient.preCheck(playerId, yuan);
        if ("BUY".equals(side) && yuan.compareTo(balanceBefore) > 0) {
            throw new BusinessException(400, "余额不足");
        }

        if ("BUY".equals(side)) {
            debit(playerId, yuan, "TRADE_BUY");
        } else {
            credit(playerId, yuan, "TRADE_SELL");
        }
        balanceCache.evict(key);

        BigDecimal balanceAfter = ("BUY".equals(side) ? balanceBefore.subtract(yuan) : balanceBefore.add(yuan))
                .setScale(YUAN_SCALE, RoundingMode.HALF_UP);
        logger.info("交易结算完成: playerId={}, bizId={}, side={}, amount={}, balanceBefore={}, balanceAfter={}",
                playerId, bizId, side, yuan, balanceBefore, balanceAfter);
        return new BalanceChange(balanceBefore, balanceAfter);
    }

    public BalanceChange credit(String playerId, BigDecimal amount, String ledgerType) {
        long deltaRaw = UnitConverter.toRaw(amount);
        long afterRaw = ledgerRepository.credit(playerId, deltaRaw, ledgerType);
        return changeOf(afterRaw, deltaRaw, true);
    }

    public BalanceChange debit(String playerId, BigDecimal amount, String ledgerType) {
        long deltaRaw = UnitConverter.toRaw(amount);
        long afterRaw = ledgerRepository.debit(playerId, deltaRaw, ledgerType);
        return changeOf(afterRaw, deltaRaw, false);
    }

    public Map<String, Object> getLedger(String playerId) {
        long balanceRaw = ledgerRepository.getBalanceRaw(playerId);
        List<LedgerEntry> entries = ledgerRepository.getEntriesDesc(playerId);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("playerId", playerId);
        data.put("unit", "CNY");
        data.put("rawUnit", "厘");
        data.put("balance", UnitConverter.toYuan(balanceRaw).setScale(YUAN_SCALE, RoundingMode.HALF_UP));
        data.put("balanceRaw", balanceRaw);

        List<Map<String, Object>> entryViews = new ArrayList<>();
        for (LedgerEntry entry : entries) {
            Map<String, Object> view = new LinkedHashMap<>();
            view.put("seq", entry.getSeq());
            view.put("type", entry.getType());
            view.put("amount", UnitConverter.toYuan(entry.getAmountRaw()).setScale(YUAN_SCALE, RoundingMode.HALF_UP));
            view.put("balanceAfter", UnitConverter.toYuan(entry.getBalanceAfterRaw()).setScale(YUAN_SCALE, RoundingMode.HALF_UP));
            view.put("at", entry.getAt().format(TIME_FORMATTER));
            entryViews.add(view);
        }

        data.put("latest", entryViews.isEmpty() ? null : entryViews.get(0));
        data.put("entries", entryViews);
        return data;
    }

    private BalanceChange changeOf(long afterRaw, long deltaRaw, boolean increased) {
        long beforeRaw = increased ? afterRaw - deltaRaw : afterRaw + deltaRaw;
        BigDecimal balanceBefore = UnitConverter.toYuan(beforeRaw).setScale(YUAN_SCALE, RoundingMode.HALF_UP);
        BigDecimal balanceAfter = UnitConverter.toYuan(afterRaw).setScale(YUAN_SCALE, RoundingMode.HALF_UP);
        return new BalanceChange(balanceBefore, balanceAfter);
    }

    private String cacheKey(String playerId) {
        return "wallet:balance:" + playerId;
    }
}
