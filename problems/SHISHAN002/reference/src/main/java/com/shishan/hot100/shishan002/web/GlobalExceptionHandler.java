package com.shishan.hot100.shishan002.web;

import com.shishan.hot100.shishan002.dto.ApiResponse;
import com.shishan.hot100.shishan002.exception.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(HttpServletRequest request, BusinessException ex) {
        logger.info("业务处理失败: path={}, code={}, msg={}", request.getRequestURI(), ex.getCode(), ex.getMessage());
        return ResponseEntity.ok(ApiResponse.fail(ex.getCode(), ex.getMessage()));
    }
}
