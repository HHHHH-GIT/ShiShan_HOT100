package com.shishan.hot100.chat.model;

public class Message {
    private Long id;
    private String clientMsgId;
    private String conversationId;
    private String senderId;
    private String content;
    private long sequence;
    private long createdAt;
    private boolean acked;
    private long ackedAt;

    public Message() {}

    public Message(Long id, String clientMsgId, String conversationId, String senderId, String content, long sequence, long createdAt) {
        this.id = id;
        this.clientMsgId = clientMsgId;
        this.conversationId = conversationId;
        this.senderId = senderId;
        this.content = content;
        this.sequence = sequence;
        this.createdAt = createdAt;
        this.acked = false;
        this.ackedAt = 0;
    }

    public Long getId() {
        return id;
    }

    public Long getMsgId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getClientMsgId() {
        return clientMsgId;
    }

    public void setClientMsgId(String clientMsgId) {
        this.clientMsgId = clientMsgId;
    }

    public String getConversationId() {
        return conversationId;
    }

    public void setConversationId(String conversationId) {
        this.conversationId = conversationId;
    }

    public String getSenderId() {
        return senderId;
    }

    public void setSenderId(String senderId) {
        this.senderId = senderId;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public long getSequence() {
        return sequence;
    }

    public void setSequence(long sequence) {
        this.sequence = sequence;
    }

    public long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(long createdAt) {
        this.createdAt = createdAt;
    }

    public boolean isAcked() {
        return acked;
    }

    public void setAcked(boolean acked) {
        this.acked = acked;
    }

    public long getAckedAt() {
        return ackedAt;
    }

    public void setAckedAt(long ackedAt) {
        this.ackedAt = ackedAt;
    }
}
