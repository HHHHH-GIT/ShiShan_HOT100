package com.sky.controller.user;

import com.sky.result.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.web.bind.annotation.*;

@RestController("userShopController")
@RequestMapping("/user/shop")
@Slf4j
public class ShopController {

    @Autowired
    private RedisTemplate redisTemplate;

    private static final String KEY = "SHOP_STATUS";

    @GetMapping("/status")
    public Result<Integer> getStatus() {
        Integer st = (Integer) redisTemplate.opsForValue().get(KEY);
        log.info("获取营业状态为:{}", st == 1 ? "营业中" : "已打烊");
        return Result.success(st);
    }
    
}
