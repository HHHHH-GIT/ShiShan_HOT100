package com.sky.service;

import com.sky.dto.ShoppingCartDTO;
import com.sky.entity.ShoppingCart;

import java.util.List;

public interface ShoppingCartService {
    void add(ShoppingCartDTO shoppingCartDTO);

    List<ShoppingCart> list(Long id);

    void cleanById(Long id);

    void sub(ShoppingCartDTO shoppingCartDTO);
}
