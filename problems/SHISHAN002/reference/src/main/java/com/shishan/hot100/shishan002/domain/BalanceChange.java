package com.shishan.hot100.shishan002.domain;

import java.math.BigDecimal;

public class BalanceChange {

    private final BigDecimal balanceBefore;

    private final BigDecimal balanceAfter;

    public BalanceChange(BigDecimal balanceBefore, BigDecimal balanceAfter) {
        this.balanceBefore = balanceBefore;
        this.balanceAfter = balanceAfter;
    }

    public BigDecimal getBalanceBefore() {
        return balanceBefore;
    }

    public BigDecimal getBalanceAfter() {
        return balanceAfter;
    }
}
