package com.sky.service.impl;

import com.alibaba.fastjson.JSON;
import com.github.pagehelper.Page;
import com.github.pagehelper.PageHelper;
import com.sky.constant.MessageConstant;
import com.sky.context.BaseContext;
import com.sky.dto.*;
import com.sky.entity.*;
import com.sky.exception.AddressBookBusinessException;
import com.sky.exception.OrderBusinessException;
import com.sky.exception.ShoppingCartBusinessException;
import com.sky.mapper.*;
import com.sky.result.PageResult;
import com.sky.service.OrderService;
import com.sky.vo.OrderStatisticsVO;
import com.sky.vo.OrderSubmitVO;
import com.sky.vo.OrderVO;
import com.sky.websocket.WebSocketServer;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;


@Service
public class OrderServiceImpl implements OrderService {

    @Autowired
    private OrderMapper orderMapper;

    @Autowired
    private WebSocketServer webSocketServer;

    @Autowired
    private ShoppingCartMapper shoppingCartMapper;

    @Autowired
    private AddressBookMapper addressBookMapper;

    @Autowired
    private OrderDetailMapper orderDetailMapper;
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private CouponMapper couponMapper;

    @Transactional
    @Override
    public OrderSubmitVO submit(OrdersSubmitDTO ordersSubmitDTO) {
        Long addressBookId = ordersSubmitDTO.getAddressBookId();
        AddressBook addressBook = addressBookMapper.getById(addressBookId);
        if(addressBook == null){
            throw new AddressBookBusinessException(MessageConstant.ADDRESS_BOOK_IS_NULL);
        }

        ShoppingCart shoppingCart = new ShoppingCart();
        Long userId = BaseContext.getCurrentId();
        shoppingCart.setUserId(userId);
        List<ShoppingCart> list = shoppingCartMapper.list(shoppingCart);
        if(list == null || list.size() == 0) {
            throw new ShoppingCartBusinessException(MessageConstant.SHOPPING_CART_IS_NULL);
        }

        Orders orders = new Orders();
        BeanUtils.copyProperties(ordersSubmitDTO, orders);

        BigDecimal total = BigDecimal.ZERO;
        for (ShoppingCart cart : list) {
            total = total.add(cart.getAmount().multiply(BigDecimal.valueOf(cart.getNumber())));
        }

        if (ordersSubmitDTO.getCouponId() != null) {
            int affected = couponMapper.useCoupon(ordersSubmitDTO.getCouponId(), userId);
            if (affected > 0) {
                Coupon coupon = couponMapper.getById(ordersSubmitDTO.getCouponId());
                total = total.subtract(coupon.getAmount());
            }
        }
        if (total.compareTo(BigDecimal.ZERO) < 0) {
            total = BigDecimal.ZERO;
        }
        orders.setAmount(total);

        orders.setNumber(UUID.randomUUID().toString().substring(0, 4)+System.currentTimeMillis());
        orders.setUserId(userId);
        orders.setAddress(addressBook.getDetail());
        orders.setConsignee(addressBook.getConsignee());
        orders.setPhone(addressBook.getPhone());
        orders.setUserName(addressBook.getConsignee());
        orders.setOrderTime(LocalDateTime.now());
        orders.setPayStatus(Orders.PAID);
        orders.setStatus(Orders.TO_BE_CONFIRMED);
        if (orders.getDeliveryStatus() == null) orders.setDeliveryStatus(1);
        if (orders.getTablewareStatus() == null) orders.setTablewareStatus(1);
        if (orders.getPackAmount() == null) orders.setPackAmount(0);
        if (orders.getTablewareNumber() == null) orders.setTablewareNumber(0);

        orderMapper.insert(orders);

        List<OrderDetail> orderDetails = list.stream().map(
                cart ->{
                    OrderDetail orderDetail = new OrderDetail();
                    BeanUtils.copyProperties(cart, orderDetail);
                    orderDetail.setNumber(cart.getNumber());
                    orderDetail.setOrderId(orders.getId());
                    return orderDetail;
                }
        ).toList();
        orderDetailMapper.insertBatch(orderDetails);

        shoppingCartMapper.deleteByUserId(userId);

        org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        Map<String, Object> wsMap = new HashMap<>();
                        wsMap.put("type", 1);
                        wsMap.put("orderId", orders.getId());
                        wsMap.put("content", "订单号：" + orders.getNumber());
                        webSocketServer.sendToAllClient(JSON.toJSONString(wsMap));
                    }
                }
        );

        OrderSubmitVO orderSubmitVO = OrderSubmitVO.builder()
                .id(orders.getId())
                .orderNumber(orders.getNumber())
                .orderAmount(orders.getAmount())
                .orderTime(orders.getOrderTime())
                .build();
        return orderSubmitVO;
    }

    @Override
    public PageResult page(OrdersPageQueryDTO ordersPageQueryDTO) {
        Integer page = ordersPageQueryDTO.getPage();
        Integer pageSize = ordersPageQueryDTO.getPageSize();
        PageHelper.startPage(page, pageSize);
        Page<OrderVO> pageQuery = (Page<OrderVO>) orderMapper.page(ordersPageQueryDTO);

        for(OrderVO orderVO : pageQuery){
            //Long userId = orderVO.getUserId();
            AddressBook addressBook = addressBookMapper.getById(orderVO.getAddressBookId());
            if(addressBook != null){
                orderVO.setPhone(addressBook.getPhone());
            }
            List<OrderDetail> orderDetailList = orderDetailMapper.getByOrderId(orderVO.getId());
            orderVO.setOrderDetailList(orderDetailList);
        }
        PageResult result = new PageResult(pageQuery.getTotal(), pageQuery.getResult());
        return result;
    }

    @Override
    public OrderVO getDetail(Long id) {
        OrderVO vo = orderMapper.getById(id);
        AddressBook addressBook = addressBookMapper.getById(vo.getAddressBookId());
        vo.setPhone(addressBook.getPhone());
        vo.setOrderDetailList(orderDetailMapper.getByOrderId(id));
        return vo;
    }

    @Override
    public void cancel(Long orderId) {
        Orders orders = orderMapper.getById(orderId);
        if (orders == null) {
            throw new OrderBusinessException(MessageConstant.ORDER_NOT_FOUND);
        }
        int rows = orderMapper.updateStatusWithExpected(orderId, Orders.CANCELLED, orders.getStatus());
        if (rows == 0) {
            throw new OrderBusinessException(MessageConstant.ORDER_STATUS_ERROR);
        }
    }

    @Override
    public OrderStatisticsVO count() {
        List<Map<String, Long>> count = orderMapper.count();
        OrderStatisticsVO vo = new OrderStatisticsVO();
        for(Map<String, Long> map : count){

            Integer status = Integer.parseInt(String.valueOf(map.get("status")));
            Integer cnt = Integer.parseInt(String.valueOf(map.get("cnt")));
            if(status.equals(Orders.CONFIRMED)){
                vo.setConfirmed(cnt);
            }
            else if(status.equals(Orders.DELIVERY_IN_PROGRESS)){
                vo.setDeliveryInProgress(cnt);
            }
            else if(status.equals(Orders.TO_BE_CONFIRMED)){
                vo.setToBeConfirmed(cnt);
            }
        }
        return vo;
    }

    @Override
    public void confirm(OrdersConfirmDTO ordersConfirmDTO) {
        Long id = ordersConfirmDTO.getId();
        Orders orders = orderMapper.getById(id);
        if (orders == null) {
            throw new OrderBusinessException(MessageConstant.ORDER_NOT_FOUND);
        }
        int rows = orderMapper.updateStatusWithExpected(id, Orders.CONFIRMED, Orders.TO_BE_CONFIRMED);
        if (rows == 0) {
            throw new OrderBusinessException(MessageConstant.ORDER_STATUS_ERROR);
        }
    }

    @Override
    public void rejection(OrdersRejectionDTO ordersRejectionDTO) {
        Long id = ordersRejectionDTO.getId();
        String messgae = ordersRejectionDTO.getRejectionReason();

        Orders orders = orderMapper.getById(id);
        checkOrderStatus(orders, Orders.TO_BE_CONFIRMED);

        orders.setStatus(Orders.CANCELLED);
        orders.setCancelTime(LocalDateTime.now());
        orders.setCancelReason(messgae);
        orders.setRejectionReason(messgae);

        orderMapper.update(orders);
    }

    @Override
    public void cancel(OrdersCancelDTO ordersCancelDTO) {
        Long id = ordersCancelDTO.getId();
        String messgae = ordersCancelDTO.getCancelReason();

        Orders orders = orderMapper.getById(id);
        checkOrderStatus(orders, Orders.CONFIRMED);

        orders.setStatus(Orders.CANCELLED);
        orders.setCancelReason(messgae);
        orders.setCancelTime(LocalDateTime.now());

        orderMapper.update(orders);
    }

    @Override
    public void delivery(Long id) {
        Orders orders = orderMapper.getById(id);
        checkOrderStatus(orders, Orders.CONFIRMED);

        orders.setStatus(Orders.DELIVERY_IN_PROGRESS);

        orders.setDeliveryStatus(1);

        orderMapper.update(orders);
    }

    @Override
    public void complete(Long id) {
        Orders orders = orderMapper.getById(id);
        checkOrderStatus(orders, Orders.DELIVERY_IN_PROGRESS);

        orders.setStatus(Orders.COMPLETED);
        orders.setDeliveryTime(LocalDateTime.now());

        orderMapper.update(orders);
    }

    @Override
    public void reminder(Long id) {
        Orders currentOrder = orderMapper.getById(id);
        Map<String,Object> map = new HashMap<>();
        map.put("type",2);
        map.put("orderId",currentOrder.getId());
        map.put("content","订单号:" + currentOrder.getNumber());
        webSocketServer.sendToAllClient(JSON.toJSONString(map));
    }

    private void checkOrderStatus(Orders orders,Integer targetStatus) {
        if(orders == null){
            throw new OrderBusinessException(MessageConstant.ORDER_NOT_FOUND);
        }
        if(!orders.getStatus().equals(targetStatus)){
            throw new OrderBusinessException(MessageConstant.ORDER_STATUS_ERROR);
        }
    }
}
