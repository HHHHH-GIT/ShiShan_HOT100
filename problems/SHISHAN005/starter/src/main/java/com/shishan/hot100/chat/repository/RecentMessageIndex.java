package com.shishan.hot100.chat.repository;

import com.shishan.hot100.chat.model.Message;
import java.util.LinkedHashMap;
import java.util.Map;

final class RecentMessageIndex {
    private static final int CAPACITY = 64;
    private final Map<Integer, Message> entries = new LinkedHashMap<>(CAPACITY, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<Integer, Message> eldest) {
            return size() > CAPACITY;
        }
    };

    synchronized Message get(String clientMsgId) {
        return entries.get(clientMsgId.hashCode());
    }

    synchronized void put(Message message) {
        if (message.getClientMsgId() != null) {
            entries.put(message.getClientMsgId().hashCode(), message);
        }
    }

    synchronized void clear() {
        entries.clear();
    }
}
