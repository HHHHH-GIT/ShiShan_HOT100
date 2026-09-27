package com.shishan.hot100.chat.model;

import java.util.List;

public class PageResult {
    private List<Message> messages;
    private boolean hasMore;
    private Long nextCursor;
    private int total;

    public PageResult() {}

    public PageResult(List<Message> messages, boolean hasMore, Long nextCursor, int total) {
        this.messages = messages;
        this.hasMore = hasMore;
        this.nextCursor = nextCursor;
        this.total = total;
    }

    public List<Message> getMessages() {
        return messages;
    }

    public void setMessages(List<Message> messages) {
        this.messages = messages;
    }

    public boolean isHasMore() {
        return hasMore;
    }

    public void setHasMore(boolean hasMore) {
        this.hasMore = hasMore;
    }

    public Long getNextCursor() {
        return nextCursor;
    }

    public void setNextCursor(Long nextCursor) {
        this.nextCursor = nextCursor;
    }

    public int getTotal() {
        return total;
    }

    public void setTotal(int total) {
        this.total = total;
    }
}
