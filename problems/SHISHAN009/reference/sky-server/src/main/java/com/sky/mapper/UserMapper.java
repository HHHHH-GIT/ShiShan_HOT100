package com.sky.mapper;

import com.sky.entity.User;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Mapper
public interface UserMapper {

    @Select("select * from `user` where openid = #{openid}")
    User getByOpenId(String openid);


    @Options(useGeneratedKeys = true, keyProperty = "id")
    @Insert("insert into `user`(openid, name, phone, sex, id_number, avatar, create_time) " +
            "values (#{openid}, #{name}, #{phone}, #{sex}, #{idNumber}, #{avatar}, #{createTime})")
    void insert(User user);

    @Select("select * from `user` where id = #{userId}")
    User getById(Long userId);

    @Select("select * from `user` where create_time >= #{beginDate} and create_time <= #{endDate}")
    List<User> getBetween(LocalDate beginDate, LocalDate endDate);

    @Select("select count(*) from `user`")
    Long count();

    @Select("select count(*) from `user` where create_time <= #{date}")
    Long countBefore(LocalDate date);

    Integer countByMap(Map map);
}
