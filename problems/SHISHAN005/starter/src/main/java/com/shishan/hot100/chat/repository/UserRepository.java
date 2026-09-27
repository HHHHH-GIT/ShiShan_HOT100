package com.shishan.hot100.chat.repository;

import com.shishan.hot100.chat.model.User;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public class UserRepository {
    private final Map<String, User> userMap = new ConcurrentHashMap<>();

    public UserRepository() {
        seedDefaults();
    }

    private void seedDefaults() {
        userMap.put("u1", new User("u1", "alice", "Alice", "ONLINE", "/avatars/alice.png"));
        userMap.put("u2", new User("u2", "bob", "Bob", "ONLINE", "/avatars/bob.png"));
        userMap.put("u3", new User("u3", "carol", "Carol", "AWAY", "/avatars/carol.png"));
        userMap.put("admin", new User("admin", "sysadmin", "Administrator", "ONLINE", "/avatars/admin.png"));
    }

    public User findById(String id) {
        if (id == null) {
            return null;
        }
        return userMap.get(id);
    }

    public void save(User user) {
        if (user != null && user.getId() != null) {
            userMap.put(user.getId(), user);
        }
    }

    public List<User> findAll() {
        return new ArrayList<>(userMap.values());
    }

    public List<User> findOnlineUsers() {
        List<User> result = new ArrayList<>();
        for (User u : userMap.values()) {
            if ("ONLINE".equalsIgnoreCase(u.getStatus())) {
                result.add(u);
            }
        }
        return result;
    }

    public void clear() {
        userMap.clear();
        seedDefaults();
    }
}
