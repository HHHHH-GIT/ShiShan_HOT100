package com.shishan.hot100.chat.service;

import com.shishan.hot100.chat.model.User;
import com.shishan.hot100.chat.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class AuthService {
    @Autowired
    private UserRepository userRepository;

    private final Map<String, String> tokenToUserId = new ConcurrentHashMap<>();
    private final Map<String, Long> tokenExpireAt = new ConcurrentHashMap<>();
    private final Map<String, String> userPasswords = new ConcurrentHashMap<>();
    private final AtomicLong userSequence = new AtomicLong(100);

    @PostConstruct
    public void init() {
        seedDefaults();
    }

    private void seedDefaults() {
        userPasswords.put("alice", "password123");
        userPasswords.put("bob", "password123");
        userPasswords.put("carol", "password123");
        userPasswords.put("stress", "password123");

        tokenToUserId.put("token_u1_fixed", "u1");
        tokenExpireAt.put("token_u1_fixed", Long.MAX_VALUE);

        tokenToUserId.put("token_u2_fixed", "u2");
        tokenExpireAt.put("token_u2_fixed", Long.MAX_VALUE);

        tokenToUserId.put("token_stress_fixed", "u_stress");
        tokenExpireAt.put("token_stress_fixed", Long.MAX_VALUE);
    }

    public Map<String, Object> register(String username, String password, String nickname) {
        if (username == null || username.trim().isEmpty() || password == null || password.trim().isEmpty()) {
            return null;
        }
        if (userRepository.findByUsername(username) != null) {
            return null;
        }
        String userId = "u_" + userSequence.incrementAndGet();
        User user = new User(userId, username, nickname != null ? nickname : username, "ONLINE", "/avatars/default.png");
        userRepository.save(user);
        userPasswords.put(username, password);

        String token = "tok_" + UUID.randomUUID().toString().replace("-", "");
        tokenToUserId.put(token, userId);
        tokenExpireAt.put(token, System.currentTimeMillis() + 86400000L);

        Map<String, Object> result = new HashMap<>();
        result.put("userId", userId);
        result.put("username", username);
        result.put("token", token);
        return result;
    }

    public Map<String, Object> login(String username, String password) {
        if (username == null || password == null) {
            return null;
        }
        User user = userRepository.findByUsername(username);
        if (user == null) {
            return null;
        }
        String storedPassword = userPasswords.get(username);
        if (storedPassword == null || !storedPassword.equals(password)) {
            return null;
        }

        String token = "tok_" + UUID.randomUUID().toString().replace("-", "");
        tokenToUserId.put(token, user.getId());
        tokenExpireAt.put(token, System.currentTimeMillis() + 86400000L);

        Map<String, Object> result = new HashMap<>();
        result.put("userId", user.getId());
        result.put("username", user.getUsername());
        result.put("nickname", user.getNickname());
        result.put("token", token);
        return result;
    }

    public String validateToken(String token) {
        if (token == null) {
            return null;
        }
        Long expireTime = tokenExpireAt.get(token);
        if (expireTime == null || System.currentTimeMillis() > expireTime) {
            return null;
        }
        return tokenToUserId.get(token);
    }

    public boolean logout(String token) {
        if (token == null) {
            return false;
        }
        tokenToUserId.remove(token);
        tokenExpireAt.remove(token);
        return true;
    }

    public void clearTokens() {
        tokenToUserId.clear();
        tokenExpireAt.clear();
        seedDefaults();
    }
}
