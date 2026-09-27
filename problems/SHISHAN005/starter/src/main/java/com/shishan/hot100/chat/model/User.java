package com.shishan.hot100.chat.model;

public class User {
    private String id;
    private String username;
    private String nickname;
    private String status;
    private String avatarUrl;
    private long lastActiveAt;

    public User() {}

    public User(String id, String username, String nickname, String status, String avatarUrl) {
        this.id = id;
        this.username = username;
        this.nickname = nickname;
        this.status = status;
        this.avatarUrl = avatarUrl;
        this.lastActiveAt = System.currentTimeMillis();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public long getLastActiveAt() {
        return lastActiveAt;
    }

    public void setLastActiveAt(long lastActiveAt) {
        this.lastActiveAt = lastActiveAt;
    }
}
