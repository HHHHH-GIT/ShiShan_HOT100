package com.shishan.hot100.chat.model;

import java.util.List;

public class InboxResult {
    private List<Message> messages;
    private int count;

    public InboxResult() {}

    public InboxResult(List<Message> messages, int count) {
        this.messages = messages;
        this.count = count;
    }

    public List<Message> getMessages() {
        return messages;
    }

    public void setMessages(List<Message> messages) {
        this.messages = messages;
    }

    public int getCount() {
        return count;
    }

    public void setCount(int count) {
        this.count = count;
    }
}
