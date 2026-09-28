package com.sky.mapper;

import com.sky.entity.Coupon;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface CouponMapper {

    @Select("select * from coupon where id = #{id}")
    Coupon getById(Long id);

    @Update("update coupon set status = #{status} where id = #{id}")
    void update(Coupon coupon);

    @Update("update coupon set status = 1 where id = #{id} and user_id = #{userId} and status = 0")
    int useCoupon(@Param("id") Long id, @Param("userId") Long userId);
}
