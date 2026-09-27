package com.shishan.hot100.shishan001.web;

import com.shishan.hot100.shishan001.dto.ApiResponse;
import com.shishan.hot100.shishan001.exception.BusinessException;
import com.shishan.hot100.shishan001.exception.TimeoutGuardException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
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

    @ExceptionHandler(TimeoutGuardException.class)
    public ResponseEntity<ApiResponse<Void>> handleTimeoutGuard(HttpServletRequest request, TimeoutGuardException ex) {
        Object start = request.getAttribute(RequestTimingFilter.START_TIME_ATTR);
        long elapsed = (start instanceof Long) ? System.currentTimeMillis() - (Long) start : 0L;
        logger.error("TIMEOUT_GUARD: request degraded, returning 601; path={}; elapsed={}ms",
                request.getRequestURI(), elapsed);
        return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT)
                .body(ApiResponse.fail(601, "系统繁忙，请稍后重试"));
    }
}
