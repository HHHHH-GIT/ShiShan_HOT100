package com.shishan.hot100.chat.model;

public class RecallRequest {
    private Long msgId;
    private String conversationId;
    private String operatorId;

    public RecallRequest() {}

    public RecallRequest(Long msgId, String conversationId, String operatorId) {
        this.msgId = msgId;
        this.conversationId = conversationId;
        this.operatorId = operatorId;
    }

    public Long getMsgId() {
        return msgId;
    }

    public void setMsgId(Long msgId) {
        this.msgId = msgId;
    }

    public String getConversationId() {
        return conversationId;
    }

    public void setConversationId(String conversationId) {
        this.conversationId = conversationId;
    }

    public String getOperatorId() {
        return operatorId;
    }

    public void setOperatorId(String operatorId) {
        this.operatorId = operatorId;
    }
}
