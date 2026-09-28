package com.sky.config;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.lang.reflect.Proxy;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public class InMemoryRedisTemplate extends RedisTemplate<Object, Object> {

    private final Map<String, Object> storage = new ConcurrentHashMap<>();
    private final ValueOperations<Object, Object> valueOperations;

    @SuppressWarnings("unchecked")
    public InMemoryRedisTemplate() {
        this.valueOperations = (ValueOperations<Object, Object>) Proxy.newProxyInstance(
                ValueOperations.class.getClassLoader(),
                new Class<?>[]{ValueOperations.class},
                (proxy, method, args) -> {
                    String name = method.getName();
                    if ("get".equals(name) && args != null && args.length >= 1) {
                        return storage.get(String.valueOf(args[0]));
                    } else if ("set".equals(name) && args != null && args.length >= 2) {
                        storage.put(String.valueOf(args[0]), args[1]);
                        return null;
                    } else if ("setIfAbsent".equals(name) && args != null && args.length >= 2) {
                        return storage.putIfAbsent(String.valueOf(args[0]), args[1]) == null;
                    } else if ("increment".equals(name) && args != null && args.length >= 1) {
                        String k = String.valueOf(args[0]);
                        long delta = (args.length >= 2 && args[1] instanceof Number) ? ((Number) args[1]).longValue() : 1L;
                        Object old = storage.get(k);
                        long current = old instanceof Number ? ((Number) old).longValue() : 0L;
                        long next = current + delta;
                        storage.put(k, next);
                        return next;
                    }
                    return null;
                }
        );
    }

    @Override
    public void afterPropertiesSet() {
        // In-memory mock: skip connection factory assertion
    }

    @Override
    public ValueOperations<Object, Object> opsForValue() {
        return valueOperations;
    }

    @Override
    public Set<Object> keys(Object pattern) {
        if (pattern == null) return Collections.emptySet();
        String pat = String.valueOf(pattern).replace("*", ".*");
        Pattern regex = Pattern.compile(pat);
        return storage.keySet().stream()
                .filter(k -> regex.matcher(k).matches())
                .map(k -> (Object) k)
                .collect(Collectors.toSet());
    }

    @Override
    public Boolean delete(Object key) {
        if (key == null) return false;
        return storage.remove(String.valueOf(key)) != null;
    }

    @Override
    public Long delete(Collection<Object> keys) {
        if (keys == null || keys.isEmpty()) return 0L;
        long count = 0;
        for (Object k : keys) {
            if (storage.remove(String.valueOf(k)) != null) {
                count++;
            }
        }
        return count;
    }
}
