package com.shishan.hot100.chat.model;

import java.util.List;

public class TimelineResult {
    private List<Message> messages;
    private int totalCount;

    public TimelineResult() {}

    public TimelineResult(List<Message> messages, int totalCount) {
        this.messages = messages;
        this.totalCount = totalCount;
    }

    public List<Message> getMessages() {
        return messages;
    }

    public void setMessages(List<Message> messages) {
        this.messages = messages;
    }

    public int getTotalCount() {
        return totalCount;
    }

    public void setTotalCount(int totalCount) {
        this.totalCount = totalCount;
    }
}
