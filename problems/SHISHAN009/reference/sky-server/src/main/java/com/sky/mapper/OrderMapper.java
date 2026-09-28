package com.sky.mapper;

import com.sky.dto.GoodsSalesDTO;
import com.sky.dto.OrdersPageQueryDTO;
import com.sky.entity.Orders;
import com.sky.vo.OrderVO;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Mapper
public interface OrderMapper {

    @Options(useGeneratedKeys = true, keyProperty = "id")
    @Insert("insert into orders (number, status, user_id, address_book_id, order_time, " +
            "checkout_time, pay_method, pay_status, amount, remark, phone, address, " +
            "user_name, consignee, cancel_reason, rejection_reason, cancel_time, " +
            "estimated_delivery_time, delivery_status, delivery_time, pack_amount, " +
            "tableware_number, tableware_status)" +
            "values (#{number}, #{status}, #{userId}, #{addressBookId}, #{orderTime}," +
            " #{checkoutTime},#{payMethod}, #{payStatus}, #{amount}, #{remark}, #{phone},#{address}," +
            "#{userName}, #{consignee}, #{cancelReason}, #{rejectionReason}, #{cancelTime}," +
            "#{estimatedDeliveryTime}, #{deliveryStatus}, #{deliveryTime}, #{packAmount}," +
            "#{tablewareNumber}, #{tablewareStatus} )")
    void insert(Orders orders);

    @Select("select * from orders where number = #{orderNumber}")
    Orders getByNumber(String orderNumber);

    void update(Orders orders);

    @org.apache.ibatis.annotations.Update("update orders set status = #{newStatus} where id = #{id} and status = #{expectedStatus}")
    int updateStatusWithExpected(@org.apache.ibatis.annotations.Param("id") Long id,
                                 @org.apache.ibatis.annotations.Param("newStatus") Integer newStatus,
                                 @org.apache.ibatis.annotations.Param("expectedStatus") Integer expectedStatus);

    List<OrderVO> page(OrdersPageQueryDTO orderPageQueryDTO);

    @Select("select * from orders where id = #{id}")
    OrderVO getById(Long id);

    //让status作为key，如何实现？


    @Select("select status ,count(*) as cnt from orders group by status")
    List<Map<String, Long>> count();

    @Select("select * from orders where order_time >= #{beginTime} and order_time <= #{endTime} order by order_time desc, id desc")
    List<Orders> getBetween(LocalDateTime beginTime, LocalDateTime endTime);

    @Select("select * from orders where status = #{status} and order_time < #{time}")
    List<Orders> getByStatusAndOrdertimeLT(Integer status, LocalDateTime time);


    List<GoodsSalesDTO> getSalesTop10(LocalDateTime begin, LocalDateTime end);


    Double sumByMap(Map map);

    Integer countByMap(Map map);
}
