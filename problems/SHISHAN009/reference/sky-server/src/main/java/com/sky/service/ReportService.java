package com.sky.service;

import com.sky.vo.*;

import javax.servlet.http.HttpServletResponse;
import java.time.LocalDate;

public interface ReportService {
//    TurnoverReportVO turnover(LocalDate beginDate, LocalDate endDate);
//
//    OrderReportVO countOrder(LocalDate beginDate, LocalDate endDate);
//
//    UserReportVO countUser(LocalDate beginDate, LocalDate endDate);
//
//    SalesTop10ReportVO getSalesTop10(LocalDate begin, LocalDate end);
    TurnoverReportVO getTurnover(LocalDate beginTime, LocalDate endTime);

    UserReportVO getUserStatistics(LocalDate begin, LocalDate end);

    OrderReportVO getOrderStatistics(LocalDate begin, LocalDate end);

    SalesTop10ReportVO getSalesTop10(LocalDate begin, LocalDate end);

    void exportBusinessData(HttpServletResponse response);

    java.util.List<com.sky.entity.Orders> getOrderList(LocalDate begin, LocalDate end);
}
