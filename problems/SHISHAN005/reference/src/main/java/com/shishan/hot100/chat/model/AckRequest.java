package com.shishan.hot100.chat.model;

public class AckRequest {
    private String conversationId;
    private Long msgId;
    private String userId;

    public AckRequest() {}

    public AckRequest(String conversationId, Long msgId, String userId) {
        this.conversationId = conversationId;
        this.msgId = msgId;
        this.userId = userId;
    }

    public String getConversationId() {
        return conversationId;
    }

    public void setConversationId(String conversationId) {
        this.conversationId = conversationId;
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
}
