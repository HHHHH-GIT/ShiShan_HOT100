package com.shishan.hot100.chat.controller;

import com.shishan.hot100.chat.model.ApiResponse;
import com.shishan.hot100.chat.model.LoginRequest;
import com.shishan.hot100.chat.model.RegisterRequest;
import com.shishan.hot100.chat.model.User;
import com.shishan.hot100.chat.service.AuthService;
import com.shishan.hot100.chat.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @Autowired
    private AuthService authService;

    @Autowired
    private UserService userService;

    @PostMapping("/register")
    public ApiResponse<Map<String, Object>> register(@RequestBody RegisterRequest request) {
        Map<String, Object> result = authService.register(request.getUsername(), request.getPassword(), request.getNickname());
        if (result == null) {
            return ApiResponse.error(400, "User registration failed, username may already exist");
        }
        return ApiResponse.ok(result);
    }

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@RequestBody LoginRequest request) {
        Map<String, Object> result = authService.login(request.getUsername(), request.getPassword());
        if (result == null) {
            return ApiResponse.error(401, "Invalid username or password");
        }
        return ApiResponse.ok(result);
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();
            authService.logout(token);
        }
        return ApiResponse.ok();
    }

    @GetMapping("/me")
    public ApiResponse<User> getCurrentUser(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ApiResponse.error(401, "Unauthorized");
        }
        String token = authHeader.substring(7).trim();
        String userId = authService.validateToken(token);
        if (userId == null) {
            return ApiResponse.error(401, "Unauthorized");
        }
        User user = userService.getUser(userId);
        if (user == null) {
            return ApiResponse.error(404, "User not found");
        }
        return ApiResponse.ok(user);
    }
}
