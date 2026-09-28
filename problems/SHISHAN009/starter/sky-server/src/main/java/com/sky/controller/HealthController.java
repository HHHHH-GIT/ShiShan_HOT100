package com.sky.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.Map;

@RestController
public class HealthController {

    @GetMapping("/hello")
    public Map<String, String> hello() {
        return Collections.singletonMap("status", "ok");
    }
}
