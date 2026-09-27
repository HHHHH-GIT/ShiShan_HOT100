package com.shishan.hot100.shishan002.cache;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class BalanceCache {

    private static final Logger logger = LoggerFactory.getLogger(BalanceCache.class);

    private static final long TTL_MILLIS = 5 * 60 * 1000L;

    private final Map<String, Entry> store = new ConcurrentHashMap<>();

    public BigDecimal get(String key) {
        Entry entry = store.get(key);
        if (entry == null) {
            logger.debug("balance cache miss, key={}", key);
            return null;
        }
        if (System.currentTimeMillis() >= entry.expireAt) {
            store.remove(key, entry);
            logger.debug("balance cache miss (expired), key={}", key);
            return null;
        }
        logger.debug("balance cache hit, key={}, value={}", key, entry.value);
        return entry.value;
    }

    public void put(String key, BigDecimal value) {
        store.put(key, new Entry(value, System.currentTimeMillis() + TTL_MILLIS));
        logger.debug("balance cache put, key={}, value={}", key, value);
    }

    public void evict(String key) {
        store.remove(key);
        logger.debug("balance cache evict, key={}", key);
    }

    public BigDecimal peek(String key) {
        Entry entry = store.get(key);
        return entry == null ? null : entry.value;
    }

    private static final class Entry {

        private final BigDecimal value;

        private final long expireAt;

        private Entry(BigDecimal value, long expireAt) {
            this.value = value;
            this.expireAt = expireAt;
        }
    }
}
