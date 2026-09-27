package com.shishan.hot100.chat.repository;

import com.shishan.hot100.chat.model.InboxResult;
import com.shishan.hot100.chat.model.Message;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Repository
public class InboxRepository {
    private final Map<String, List<Message>> userInboxes = new ConcurrentHashMap<>();

    public void add(String userId, Message message) {
        userInboxes.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>()).add(message);
    }

    public InboxResult getInbox(String userId, String conversationId) {
        List<Message> list = userInboxes.getOrDefault(userId, Collections.emptyList());
        List<Message> filtered = new ArrayList<>();
        for (Message msg : list) {
            if (conversationId == null || conversationId.equals(msg.getConversationId())) {
                filtered.add(msg);
            }
        }
        return new InboxResult(filtered, filtered.size());
    }

    public void clear() {
        userInboxes.clear();
    }
}
