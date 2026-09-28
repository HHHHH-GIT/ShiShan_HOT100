package com.sky.service.impl;

import com.sky.context.BaseContext;
import com.sky.dto.ShoppingCartDTO;
import com.sky.entity.Dish;
import com.sky.entity.Setmeal;
import com.sky.entity.ShoppingCart;
import com.sky.mapper.DishMapper;
import com.sky.mapper.SetmealMapper;
import com.sky.mapper.ShoppingCartMapper;
import com.sky.service.ShoppingCartService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ShoppingCartServiceImpl implements ShoppingCartService {

    @Autowired
    private ShoppingCartMapper shoppingCartMapper;

    @Autowired
    private DishMapper dishMapper;

    @Autowired
    private SetmealMapper setmealMapper;

    @Override
    public void add(ShoppingCartDTO shoppingCartDTO) {
        Long targetId = shoppingCartDTO.getDishId() != null ? shoppingCartDTO.getDishId() : shoppingCartDTO.getSetmealId();
        Long userId = BaseContext.getCurrentId();
        Object lock1 = ("item_" + targetId).intern();
        Object lock2 = ("user_" + userId).intern();
        synchronized (lock1) {
            synchronized (lock2) {
                ShoppingCart shoppingCart = ShoppingCart.builder()
                        .dishFlavor(shoppingCartDTO.getDishFlavor())
                        .dishId(shoppingCartDTO.getDishId())
                        .setmealId(shoppingCartDTO.getSetmealId())
                        .userId(userId)
                        .build();

                List<ShoppingCart> currentShoppingCart = shoppingCartMapper.list(shoppingCart);

                if(currentShoppingCart != null && currentShoppingCart.size() > 0) {
                    currentShoppingCart.get(0).setNumber(currentShoppingCart.get(0).getNumber() + 1);
                    shoppingCartMapper.updateNumberById(currentShoppingCart.get(0));
                    return;
                }

                shoppingCart.setNumber(1);
                shoppingCart.setCreateTime(LocalDateTime.now());
                if(shoppingCart.getDishId() != null) {
                    Dish dish = dishMapper.getById(shoppingCart.getDishId());
                    shoppingCart.setName(dish.getName());
                    shoppingCart.setImage(dish.getImage());
                    shoppingCart.setAmount(dish.getPrice());
                }
                else{
                    Setmeal setmeal = setmealMapper.getById(shoppingCart.getSetmealId());
                    shoppingCart.setName(setmeal.getName());
                    shoppingCart.setImage(setmeal.getImage());
                    shoppingCart.setAmount(setmeal.getPrice());
                }

                shoppingCartMapper.insert(shoppingCart);
            }
        }
    }

    @Override
    public List<ShoppingCart> list(Long id) {
        ShoppingCart shoppingCart = ShoppingCart.builder()
                .userId(id)
                .build();
        return shoppingCartMapper.list(shoppingCart);
    }

    @Override
    public void cleanById(Long id) {
        shoppingCartMapper.deleteByUserId(id);
    }

    @Override
    public void sub(ShoppingCartDTO shoppingCartDTO) {
        Long targetId = shoppingCartDTO.getDishId() != null ? shoppingCartDTO.getDishId() : shoppingCartDTO.getSetmealId();
        Long userId = BaseContext.getCurrentId();
        Object lock1 = ("user_" + userId).intern();
        Object lock2 = ("item_" + targetId).intern();
        synchronized (lock1) {
            synchronized (lock2) {
                ShoppingCart shoppingCart = ShoppingCart.builder()
                       .dishFlavor(shoppingCartDTO.getDishFlavor())
                       .dishId(shoppingCartDTO.getDishId())
                       .setmealId(shoppingCartDTO.getSetmealId())
                       .userId(userId)
                       .build();

                List<ShoppingCart> currentShoppingCart = shoppingCartMapper.list(shoppingCart);
                if(currentShoppingCart != null && currentShoppingCart.size() > 0) {
                    ShoppingCart cart = currentShoppingCart.get(0);
                    cart.setNumber(cart.getNumber() - 1);
                    if(cart.getNumber() <= 0) {
                        shoppingCartMapper.deleteByUserIdAndName(cart.getUserId(), cart.getName());
                    }
                    else{
                        shoppingCartMapper.updateNumberById(cart);
                    }
                }
            }
        }
    }
}
