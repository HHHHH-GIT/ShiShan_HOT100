package com.shishan.hot100.shishan002.service;

import com.shishan.hot100.shishan002.cache.BalanceCache;
import com.shishan.hot100.shishan002.exception.BusinessException;
import com.shishan.hot100.shishan002.repository.LedgerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class RiskClient {

    private static final Logger logger = LoggerFactory.getLogger(RiskClient.class);

    private static final long SIMULATED_LATENCY_MICROS = 200L;

    private static final BigDecimal MAX_AMOUNT_RATIO = new BigDecimal("10");

    private final LedgerRepository ledgerRepository;

    private final BalanceCache balanceCache;

    public RiskClient(LedgerRepository ledgerRepository, BalanceCache balanceCache) {
        this.ledgerRepository = ledgerRepository;
        this.balanceCache = balanceCache;
    }

    public BigDecimal preCheck(String playerId, BigDecimal amount) {
        callDownstream("preCheck", playerId + "/" + amount);

        long raw = ledgerRepository.getBalanceRaw(playerId);
        BigDecimal balance = UnitConverter.toYuan(raw).setScale(3, RoundingMode.HALF_UP);

        balanceCache.put(cacheKey(playerId), balance);

        if (amount.compareTo(balance.multiply(MAX_AMOUNT_RATIO)) > 0) {
            throw new BusinessException(400, "单笔金额不得超过当前余额的10倍");
        }
        return balance;
    }

    private void callDownstream(String action, String payload) {
        long deadline = System.nanoTime() + SIMULATED_LATENCY_MICROS * 1_000L;
        while (System.nanoTime() < deadline) {
            Thread.onSpinWait();
        }
        logger.debug("风控调用完成: action={}, payload={}", action, payload);
    }

    private String cacheKey(String playerId) {
        return "wallet:balance:" + playerId;
    }
}
