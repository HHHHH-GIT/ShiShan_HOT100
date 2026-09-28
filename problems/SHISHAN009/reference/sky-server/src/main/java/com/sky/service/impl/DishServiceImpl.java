package com.sky.service.impl;

import com.github.pagehelper.Page;
import com.github.pagehelper.PageHelper;
import com.sky.constant.MessageConstant;
import com.sky.constant.StatusConstant;
import com.sky.dto.DishDTO;
import com.sky.dto.DishPageQueryDTO;
import com.sky.entity.Dish;
import com.sky.entity.DishFlavor;
import com.sky.exception.DeletionNotAllowedException;
import com.sky.mapper.DishFlavorMapper;
import com.sky.mapper.DishMapper;
import com.sky.mapper.SetmealDishMapper;
import com.sky.mapper.SetmealMapper;
import com.sky.result.PageResult;
import com.sky.service.DishService;
import com.sky.vo.DishVO;
import lombok.extern.java.Log;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class DishServiceImpl implements DishService{

    @Autowired
    private DishMapper dishMapper;
    @Autowired
    private DishFlavorMapper dishFlavorMapper;
    @Autowired
    private SetmealMapper setmealMapper;
    @Autowired
    private SetmealDishMapper setmealDishMapper;

    @Transactional
    @Override
    public void saveWithFlavor(DishDTO dishDTO) {
        Dish dish = new Dish();
        BeanUtils.copyProperties(dishDTO, dish);

        dishMapper.insert(dish);
        Long id = dish.getId();

        List<DishFlavor> flavors = dishDTO.getFlavors();
        if(flavors == null || flavors.size() == 0) {
            return;
        }

        for(DishFlavor df : flavors) {
            df.setDishId(id);
        }

        dishFlavorMapper.insertBatch(flavors);

    }

    @Override
    public PageResult page(DishPageQueryDTO dishPageQueryDTO) {
        PageHelper.startPage(dishPageQueryDTO.getPage(), dishPageQueryDTO.getPageSize());

        String name = dishPageQueryDTO.getName();
        Integer categoryId = dishPageQueryDTO.getCategoryId();
        Integer status = dishPageQueryDTO.getStatus();
        Page<DishVO> pageQuery = (Page<DishVO>) dishMapper.page(name,categoryId,status);
        Long total = pageQuery.getTotal();
        List<DishVO> list = pageQuery.getResult();
        return new PageResult(total, list);
    }

    @Override
    public List<Dish> getByCategoryId(Long categoryId) {
        return dishMapper.getByCategoryId(categoryId);
    }

    @Transactional
    @Override
    public void deleteBatch(List<Long> ids) {
        if(ids == null || ids.isEmpty()){
            return;
        }
        List<Dish> dishes = dishMapper.getByIds(ids);
        for(Dish d: dishes){
            if(d.getStatus() == StatusConstant.ENABLE){
                throw new DeletionNotAllowedException(MessageConstant.DISH_ON_SALE);
            }
        }

        List<Long> setmealIds = setmealDishMapper.getSetmealIdsByDishIds(ids);
        if(setmealIds != null && setmealIds.size() > 0) {
            throw new DeletionNotAllowedException(MessageConstant.DISH_BE_RELATED_BY_SETMEAL);
        }

        dishMapper.deleteBatch(ids);
        dishFlavorMapper.deleteByDishIds(ids);
    }

    @Override
    public void updateStatus(Integer status, Long id) {
        Dish dish = Dish.builder()
                .id(id)
                .status(status)
                .build();

        dishMapper.update(dish);
    }

    @Override
    public DishVO getByIdWithFlavor(Long id) {
       DishVO dishVO = new DishVO();
       Dish dish = dishMapper.getById(id);
       BeanUtils.copyProperties(dish, dishVO);

       List<DishFlavor> flavors = dishFlavorMapper.getByDishId(id);
       dishVO.setFlavors(flavors);
       return dishVO;
    }

    @Transactional
    @Override
    public void updateWithFlavor(DishDTO dishDTO) {
        Dish dish = new Dish();
        BeanUtils.copyProperties(dishDTO, dish);

        dishMapper.update(dish);
        List<DishFlavor> flavors = dishDTO.getFlavors();
        if(flavors != null && flavors.size() > 0) {
            flavors.forEach(flavor ->{flavor.setDishId(dish.getId());});
            dishFlavorMapper.deleteByDishIds(new ArrayList<>(){{add(dish.getId());}});
            dishFlavorMapper.insertBatch(flavors);
        }
    }

    @Override
    public List<DishVO> listWithFlavor(Dish dish) {
        List<DishVO> dishList = dishMapper.page(dish.getName(),Math.toIntExact(dish.getCategoryId()), dish.getStatus());

        for (DishVO d : dishList) {
            List<DishFlavor> flavors = dishFlavorMapper.getByDishId(d.getId());
            d.setFlavors(flavors);
        }

        return dishList;
    }
}
