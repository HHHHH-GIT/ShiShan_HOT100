package com.shishan.hot100.shishan001.web;

import com.shishan.hot100.shishan001.dto.ApiResponse;
import com.shishan.hot100.shishan001.dto.CancelOrderRequest;
import com.shishan.hot100.shishan001.dto.PlaceOrderRequest;
import com.shishan.hot100.shishan001.service.OrderService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping("/orders")
    public ApiResponse<Object> placeOrder(@RequestBody PlaceOrderRequest request) {
        return ApiResponse.success(orderService.placeOrder(request.getProductId(), request.getQuantity()));
    }

    @PostMapping("/orders/cancel")
    public ApiResponse<Object> cancelOrder(@RequestBody CancelOrderRequest request) {
        return ApiResponse.success(orderService.cancelOrder(request.getOrderId()));
    }

    @GetMapping("/orders/{orderId}")
    public ApiResponse<Object> getOrder(@PathVariable String orderId) {
        return ApiResponse.success(orderService.getOrder(orderId));
    }

    @GetMapping("/products/{productId}")
    public ApiResponse<Object> getProduct(@PathVariable String productId) {
        return ApiResponse.success(orderService.getProduct(productId));
    }
}
