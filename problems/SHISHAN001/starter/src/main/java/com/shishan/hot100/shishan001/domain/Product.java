package com.shishan.hot100.shishan001.domain;

import java.util.concurrent.atomic.AtomicInteger;

public class Product {

    private final String productId;

    private final String name;

    private final AtomicInteger stock;

    public Product(String productId, String name, int stock) {
        this.productId = productId;
        this.name = name;
        this.stock = new AtomicInteger(stock);
    }

    public String getProductId() {
        return productId;
    }

    public String getName() {
        return name;
    }

    public int getStock() {
        return stock.get();
    }

    public void setStock(int value) {
        stock.set(value);
    }

    public int addStock(int delta) {
        return stock.addAndGet(delta);
    }
}
