package com.shishan.hot100.chat.model;

public class SendRequest {
    private String conversationId;
    private String senderId;
    // 客户端标识是不透明且区分大小写的字符串；历史保留期间重发沿用原消息。
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
