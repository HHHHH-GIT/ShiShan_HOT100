package com.shishan.hot100.shishan002.dto;

import java.math.BigDecimal;

public class RechargeRequest {

    private String playerId;

    private BigDecimal amount;

    public String getPlayerId() {
        return playerId;
    }

    public void setPlayerId(String playerId) {
        this.playerId = playerId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }
}
