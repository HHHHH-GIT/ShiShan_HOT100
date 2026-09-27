package com.shishan.hot100.chat.model;

public class SendRequest {
    private String conversationId;
    private String senderId;
    private String clientMsgId;
    private String content;

    public SendRequest() {}

    public SendRequest(String conversationId, String senderId, String clientMsgId, String content) {
        this.conversationId = conversationId;
        this.senderId = senderId;
        this.clientMsgId = clientMsgId;
        this.content = content;
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

    public String getClientMsgId() {
        return clientMsgId;
    }

    public void setClientMsgId(String clientMsgId) {
        this.clientMsgId = clientMsgId;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
