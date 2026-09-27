package com.shishan.hot100.chat.controller;

import com.shishan.hot100.chat.model.ApiResponse;
import com.shishan.hot100.chat.service.MetricsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/stats")
public class StatsController {
    @Autowired
    private MetricsService metricsService;

    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> getSummary() {
        return ApiResponse.ok(metricsService.getMetricsSnapshot());
    }
}
