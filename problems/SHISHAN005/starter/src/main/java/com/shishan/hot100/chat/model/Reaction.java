package com.shishan.hot100.chat.model;

public class Reaction {
    private Long msgId;
    private String userId;
    private String emoji;
    private long timestamp;

    public Reaction() {}

    public Reaction(Long msgId, String userId, String emoji) {
        this.msgId = msgId;
        this.userId = userId;
        this.emoji = emoji;
        this.timestamp = System.currentTimeMillis();
    }

    public Long getMsgId() {
        return msgId;
    }

    public void setMsgId(Long msgId) {
        this.msgId = msgId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getEmoji() {
        return emoji;
    }

    public void setEmoji(String emoji) {
        this.emoji = emoji;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }
}
