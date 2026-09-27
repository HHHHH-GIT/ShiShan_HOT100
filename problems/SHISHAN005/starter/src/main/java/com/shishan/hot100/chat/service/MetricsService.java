package com.shishan.hot100.chat.service;

import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class MetricsService {
    private final AtomicLong totalMessagesSent = new AtomicLong(0);
    private final AtomicLong totalAcksReceived = new AtomicLong(0);

    public void recordMessageSent() {
        totalMessagesSent.incrementAndGet();
    }

    public void recordAck() {
        totalAcksReceived.incrementAndGet();
    }

    public Map<String, Object> getMetricsSnapshot() {
        Map<String, Object> map = new HashMap<>();
        map.put("totalMessagesSent", totalMessagesSent.get());
        map.put("totalAcksReceived", totalAcksReceived.get());
        map.put("uptimeMs", System.currentTimeMillis());
        return map;
    }

    public void reset() {
        totalMessagesSent.set(0);
        totalAcksReceived.set(0);
    }
}
