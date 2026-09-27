package com.shishan.hot100.shishan001.service;

import com.shishan.hot100.shishan001.domain.Order;
import com.shishan.hot100.shishan001.domain.Product;
import com.shishan.hot100.shishan001.exception.BusinessException;
import com.shishan.hot100.shishan001.exception.TimeoutGuardException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

@Service
public class OrderService {

    private static final Logger logger = LoggerFactory.getLogger(OrderService.class);

    private static final long LOCK_TIMEOUT_MILLIS = 1000L;

    private final ReentrantLock productLock = new ReentrantLock(false);

    private final ReentrantLock orderLock = new ReentrantLock(false);

    private final Map<String, Product> products = new ConcurrentHashMap<>();

    private final Map<String, Order> orders = new ConcurrentHashMap<>();

    private final WarehouseClient warehouseClient;

    public OrderService(WarehouseClient warehouseClient) {
        this.warehouseClient = warehouseClient;
        products.put("P001", new Product("P001", "机械键盘", 1_000_000));
        products.put("P002", new Product("P002", "人体工学椅", 1_000_000));
        logger.info("初始化商品数据完成, 商品数量={}", products.size());
    }

    public Map<String, Object> placeOrder(String productId, Integer quantity) {
        if (productId == null || productId.isBlank()) {
            throw new BusinessException(400, "商品ID不能为空");
        }
        if (quantity == null || quantity <= 0) {
            throw new BusinessException(400, "购买数量必须大于0");
        }
        Product product = products.get(productId);
        if (product == null) {
            throw new BusinessException(400, "商品不存在: " + productId);
        }

        boolean productAcquired = false;
        boolean orderAcquired = false;
        try {

            productAcquired = tryAcquire(productLock, "productLock", productId);
            warehouseClient.reserveStock(productId, quantity);
            orderAcquired = tryAcquire(orderLock, "orderLock", productId);

            if (product.getStock() < quantity) {
                throw new BusinessException(400, "库存不足: " + productId);
            }
            product.addStock(-quantity);
            Order order = new Order(UUID.randomUUID().toString(), productId, quantity, "CREATED");
            orders.put(order.getOrderId(), order);
            logger.info("下单成功: orderId={}, productId={}, quantity={}, remainStock={}",
                    order.getOrderId(), productId, quantity, product.getStock());
            return orderView(order);
        } finally {
            if (orderAcquired) {
                orderLock.unlock();
            }
            if (productAcquired) {
                productLock.unlock();
            }
        }
    }

    public Map<String, Object> cancelOrder(String orderId) {
        if (orderId == null || orderId.isBlank()) {
            throw new BusinessException(400, "订单ID不能为空");
        }

        boolean orderAcquired = false;
        boolean productAcquired = false;
        try {

            orderAcquired = tryAcquire(orderLock, "orderLock", orderId);
            Order order = orders.get(orderId);
            if (order == null) {
                throw new BusinessException(404, "订单不存在");
            }

            warehouseClient.fetchReservation(orderId);
            productAcquired = tryAcquire(productLock, "productLock", orderId);
            if ("CANCELLED".equals(order.getStatus())) {
                logger.info("订单已取消, 幂等返回: orderId={}", orderId);
                return cancelView(orderId);
            }
            Product product = products.get(order.getProductId());
            if (product != null) {
                product.addStock(order.getQuantity());
            }
            order.setStatus("CANCELLED");
            logger.info("取消订单成功: orderId={}, productId={}, restored={}, remainStock={}",
                    orderId, order.getProductId(), order.getQuantity(),
                    product == null ? -1 : product.getStock());
            return cancelView(orderId);
        } finally {
            if (productAcquired) {
                productLock.unlock();
            }
            if (orderAcquired) {
                orderLock.unlock();
            }
        }
    }

    public Map<String, Object> getOrder(String orderId) {
        Order order = orders.get(orderId);
        if (order == null) {
            throw new BusinessException(404, "订单不存在");
        }
        return orderView(order);
    }

    public Map<String, Object> getProduct(String productId) {
        Product product = products.get(productId);
        if (product == null) {
            throw new BusinessException(404, "商品不存在");
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("productId", product.getProductId());
        data.put("name", product.getName());
        data.put("stock", product.getStock());
        return data;
    }

    private boolean tryAcquire(ReentrantLock lock, String lockName, String key) {
        boolean acquired;
        try {
            acquired = lock.tryLock(LOCK_TIMEOUT_MILLIS, TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            acquired = false;
        }
        if (!acquired) {
            logger.warn("lock acquire timeout after {}ms, possible lock-order deadlock (AB-BA) in {}; key={}",
                    LOCK_TIMEOUT_MILLIS, lockName, key);
            throw new TimeoutGuardException("lock acquire timeout: " + lockName);
        }
        return true;
    }

    private Map<String, Object> orderView(Order order) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("orderId", order.getOrderId());
        data.put("productId", order.getProductId());
        data.put("quantity", order.getQuantity());
        data.put("status", order.getStatus());
        return data;
    }

    private Map<String, Object> cancelView(String orderId) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("orderId", orderId);
        data.put("status", "CANCELLED");
        return data;
    }
}
