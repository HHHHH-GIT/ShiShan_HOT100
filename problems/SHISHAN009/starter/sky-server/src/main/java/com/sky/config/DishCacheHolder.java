package com.sky.config;

import com.sky.vo.DishVO;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class DishCacheHolder {

    private static DishCacheHolder instance;
    private final Map<Long, List<DishVO>> cache;

    private DishCacheHolder() {
        this.cache = new ConcurrentHashMap<>();
    }

    public static DishCacheHolder getInstance() {
        if (instance == null) {
            synchronized (DishCacheHolder.class) {
                if (instance == null) {
                    instance = new DishCacheHolder();
                }
            }
        }
        return instance;
    }

    public List<DishVO> get(Long categoryId) {
        return cache.get(categoryId);
    }

    public void put(Long categoryId, List<DishVO> dishes) {
        cache.put(categoryId, dishes);
    }

    public void evict(Long categoryId) {
        cache.remove(categoryId);
    }

    public void clear() {
        cache.clear();
    }
}
