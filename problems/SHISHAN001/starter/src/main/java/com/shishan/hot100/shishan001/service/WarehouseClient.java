package com.shishan.hot100.shishan001.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class WarehouseClient {

    private static final Logger logger = LoggerFactory.getLogger(WarehouseClient.class);

    private static final long SIMULATED_LATENCY_MICROS = 200L;

    public void reserveStock(String productId, int quantity) {
        callDownstream("reserveStock", productId + "/" + quantity);
    }

    public void releaseStock(String productId, int quantity) {
        callDownstream("releaseStock", productId + "/" + quantity);
    }

    public void fetchReservation(String orderId) {
        callDownstream("fetchReservation", orderId);
    }

    private void callDownstream(String action, String payload) {
        long deadline = System.nanoTime() + SIMULATED_LATENCY_MICROS * 1_000L;
        while (System.nanoTime() < deadline) {
            Thread.onSpinWait();
        }
        logger.debug("仓储同步完成: action={}, payload={}", action, payload);
    }
}
