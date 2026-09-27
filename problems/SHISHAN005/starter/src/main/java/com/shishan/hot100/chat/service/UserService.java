package com.shishan.hot100.chat.service;

import com.shishan.hot100.chat.model.User;
import com.shishan.hot100.chat.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {
    @Autowired
    private UserRepository userRepository;

    public User getUser(String userId) {
        return userRepository.findById(userId);
    }

    public List<User> listOnlineUsers() {
        return userRepository.findOnlineUsers();
    }

    public void updatePresence(String userId, String status) {
        User user = userRepository.findById(userId);
        if (user != null) {
            user.setStatus(status);
            user.setLastActiveAt(System.currentTimeMillis());
            userRepository.save(user);
        }
    }
}
