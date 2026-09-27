package com.shishan.hot100.chat.model;

public class ReactionRequest {
    private Long msgId;
    private String userId;
    private String emoji;

    public ReactionRequest() {}

    public ReactionRequest(Long msgId, String userId, String emoji) {
        this.msgId = msgId;
        this.userId = userId;
        this.emoji = emoji;
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
}
