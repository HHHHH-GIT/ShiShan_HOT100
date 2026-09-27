package com.shishan.hot100.shishan002.domain;

import java.time.LocalDateTime;

public class LedgerEntry {

    private final int seq;

    private final String type;

    private final long amountRaw;

    private final long balanceAfterRaw;

    private final LocalDateTime at;

    public LedgerEntry(int seq, String type, long amountRaw, long balanceAfterRaw, LocalDateTime at) {
        this.seq = seq;
        this.type = type;
        this.amountRaw = amountRaw;
        this.balanceAfterRaw = balanceAfterRaw;
        this.at = at;
    }

    public int getSeq() {
        return seq;
    }

    public String getType() {
        return type;
    }

    public long getAmountRaw() {
        return amountRaw;
    }

    public long getBalanceAfterRaw() {
        return balanceAfterRaw;
    }

    public LocalDateTime getAt() {
        return at;
    }
}
