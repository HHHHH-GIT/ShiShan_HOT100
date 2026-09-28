package com.sky.controller.user;

import com.alibaba.fastjson.JSON;
import com.sky.dto.*;
import com.sky.entity.Orders;
import com.sky.mapper.OrderMapper;
import com.sky.result.PageResult;
import com.sky.result.Result;
import com.sky.service.OrderService;
import com.sky.vo.OrderPaymentVO;
import com.sky.vo.OrderSubmitVO;
import com.sky.vo.OrderVO;
import com.sky.websocket.WebSocketServer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController("userOrderController")
@RequestMapping("/user/order")
@Slf4j
public class OrderController {

    @Autowired
    private WebSocketServer webSocketServer;

    @Autowired
    private OrderService orderService;

    @Autowired
    private OrderMapper orderMapper;

    @PostMapping("/submit")
    public Result<OrderSubmitVO> submit(@RequestBody OrdersSubmitDTO ordersSubmitDTO){
        log.info("订单数据：{}",ordersSubmitDTO);
        OrderSubmitVO orderSubmitVO = orderService.submit(ordersSubmitDTO);
        return Result.success(orderSubmitVO);
    }

    @PutMapping("/payment")
    public Result<OrderPaymentVO> payment(@RequestBody OrdersPaymentDTO ordersPaymentDTO) throws Exception {
        log.info("订单支付：{}", ordersPaymentDTO);
        String number = ordersPaymentDTO.getOrderNumber();
        Orders currentOrder = orderMapper.getByNumber(number);


        currentOrder.setStatus(Orders.TO_BE_CONFIRMED);
        currentOrder.setPayStatus(Orders.PAID);
        currentOrder.setCheckoutTime(LocalDateTime.now());

        orderMapper.update(currentOrder);

        OrderPaymentVO orderPaymentVO = OrderPaymentVO.builder()
                .nonceStr("1234567890")
                .packageStr("prepay_id=1234567890")
                .signType("MD5")
                .timeStamp(String.valueOf(System.currentTimeMillis() / 1000))
                .build();

        Map<String,Object> map = new HashMap<>();
        map.put("type",1);
        map.put("orderId",currentOrder.getId());
        map.put("content","订单号:" + currentOrder.getNumber());
        webSocketServer.sendToAllClient(JSON.toJSONString(map));

        return Result.success(orderPaymentVO);
    }

    @GetMapping("/historyOrders")
    public Result<PageResult> history(Integer page,Integer pageSize,Integer status){
        log.info("查询订单历史记录：{}，{}，{}",page,pageSize,status);
        OrdersPageQueryDTO ordersPageQueryDTO = new OrdersPageQueryDTO();
        ordersPageQueryDTO.setPage(page);
        ordersPageQueryDTO.setPageSize(pageSize);
        ordersPageQueryDTO.setStatus(status);
        PageResult result = orderService.page(ordersPageQueryDTO);
        return Result.success(result);
    }

    @GetMapping("/orderDetail/{id}")
    public Result<OrderVO> getDetail(@PathVariable Long id){
        log.info("查询订单详情：{}",id);
        OrderVO orderVO = orderService.getDetail(id);
        return Result.success(orderVO);
    }

    @PutMapping("/cancel/{id}")
    public Result cancelOrder(@PathVariable Long id){
        log.info("取消订单：{}",id);
        orderService.cancel(id);
        return Result.success();
    }

    @PostMapping("/repetition/{id}")
    public Result repetitionOrder(@PathVariable Long id){
        log.info("再来一单：{}",id);
        return Result.success();
    }

    @GetMapping("/reminder/{id}")
    public Result reminderOrder(@PathVariable Long id){
        log.info("催单：{}",id);
        orderService.reminder(id);


        return Result.success();
    }


}
