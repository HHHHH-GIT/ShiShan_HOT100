package com.shishan.hot100.chat.config;

import com.shishan.hot100.chat.interceptor.AuthInterceptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    @Autowired
    private AuthInterceptor authInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/chat/**", "/api/conversations/**", "/api/users/**")
                .excludePathPatterns("/hello", "/api/auth/**", "/api/chat/reset", "/api/stats/**", "/error");
    }
}
