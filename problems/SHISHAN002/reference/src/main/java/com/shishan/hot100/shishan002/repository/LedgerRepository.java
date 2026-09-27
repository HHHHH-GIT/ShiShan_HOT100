package com.shishan.hot100.shishan002.repository;

import com.shishan.hot100.shishan002.domain.LedgerEntry;
import com.shishan.hot100.shishan002.exception.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public class LedgerRepository {

    private static final Logger logger = LoggerFactory.getLogger(LedgerRepository.class);

    public static final long INIT_BALANCE_RAW = 1_000_000L;

    private final Map<String, Account> accounts = new ConcurrentHashMap<>();

    public LedgerRepository() {
        seed("P001", "夜航星");
        seed("P002", "白桦");
        logger.info("初始化账本数据完成, 玩家数量={}", accounts.size());
    }

    public boolean exists(String playerId) {
        return playerId != null && accounts.containsKey(playerId);
    }

    public long getBalanceRaw(String playerId) {
        Account account = require(playerId);
        synchronized (account) {
            return account.balanceRaw;
        }
    }

    public long credit(String playerId, long deltaRaw, String ledgerType) {
        Account account = require(playerId);
        synchronized (account) {
            account.balanceRaw += deltaRaw;
            account.appendEntry(ledgerType, deltaRaw, account.balanceRaw);
            return account.balanceRaw;
        }
    }

    public long debit(String playerId, long deltaRaw, String ledgerType) {
        Account account = require(playerId);
        synchronized (account) {
            account.balanceRaw -= deltaRaw;
            account.appendEntry(ledgerType, deltaRaw, account.balanceRaw);
            return account.balanceRaw;
        }
    }

    public List<LedgerEntry> getEntriesDesc(String playerId) {
        Account account = require(playerId);
        synchronized (account) {
            return new ArrayList<>(account.entries);
        }
    }

    private void seed(String playerId, String nickname) {
        Account account = new Account(nickname);
        account.balanceRaw = INIT_BALANCE_RAW;
        account.appendEntry("INIT", INIT_BALANCE_RAW, INIT_BALANCE_RAW);
        accounts.put(playerId, account);
        logger.info("初始化玩家账本: playerId={}, nickname={}, balanceRaw={}",
                playerId, nickname, account.balanceRaw);
    }

    private Account require(String playerId) {
        Account account = playerId == null ? null : accounts.get(playerId);
        if (account == null) {
            throw new BusinessException(404, "玩家不存在: " + playerId);
        }
        return account;
    }

    private static final class Account {

        private final String nickname;

        private long balanceRaw;

        private int seqCounter;

        private final List<LedgerEntry> entries = new ArrayList<>();

        private Account(String nickname) {
            this.nickname = nickname;
        }

        private void appendEntry(String type, long amountRaw, long balanceAfterRaw) {
            seqCounter++;
            entries.add(0, new LedgerEntry(seqCounter, type, amountRaw, balanceAfterRaw,
                    LocalDateTime.now().withNano(0)));
        }
    }
}
