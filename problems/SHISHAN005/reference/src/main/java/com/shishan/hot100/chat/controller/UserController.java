package com.shishan.hot100.chat.controller;

import com.shishan.hot100.chat.model.ApiResponse;
import com.shishan.hot100.chat.model.User;
import com.shishan.hot100.chat.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {
    @Autowired
    private UserService userService;

    @GetMapping("/{id}")
    public ApiResponse<User> getUser(@PathVariable String id) {
        User user = userService.getUser(id);
        if (user == null) {
            return ApiResponse.error(404, "User not found");
        }
        return ApiResponse.ok(user);
    }

    @GetMapping("/online")
    public ApiResponse<List<User>> getOnlineUsers() {
        return ApiResponse.ok(userService.listOnlineUsers());
    }

    @PostMapping("/presence")
    public ApiResponse<Void> updatePresence(@RequestParam String userId, @RequestParam String status) {
        userService.updatePresence(userId, status);
        return ApiResponse.ok();
    }
}
