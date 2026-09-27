package com.shishan.hot100.chat.model;

import java.util.ArrayList;
import java.util.List;

public class Conversation {
    private String id;
    private String name;
    private String type;
    private String creatorId;
    private boolean muted;
    private long createdAt;
    private List<String> memberIds = new ArrayList<>();

    public Conversation() {}

    public Conversation(String id, String name, String type, String creatorId) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.creatorId = creatorId;
        this.muted = false;
        this.createdAt = System.currentTimeMillis();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getCreatorId() {
        return creatorId;
    }

    public void setCreatorId(String creatorId) {
        this.creatorId = creatorId;
    }

    public boolean isMuted() {
        return muted;
    }

    public void setMuted(boolean muted) {
        this.muted = muted;
    }

    public long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(long createdAt) {
        this.createdAt = createdAt;
    }

    public List<String> getMemberIds() {
        return memberIds;
    }

    public void setMemberIds(List<String> memberIds) {
        this.memberIds = memberIds;
    }
}
