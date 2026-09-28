package com.shishan.hot100.chat.repository;

import com.shishan.hot100.chat.model.InboxResult;
import com.shishan.hot100.chat.model.Message;
import org.springframework.stereotype.Repository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Repository
public class InboxRepository {
    private static final Logger log = LoggerFactory.getLogger(InboxRepository.class);
    private final Map<String, Map<DeliveryKey, Message>> userInboxes = new LinkedHashMap<>();

    public synchronized void add(String userId, Message message) {
        Map<DeliveryKey, Message> inbox = userInboxes.computeIfAbsent(userId, key -> new LinkedHashMap<>());
        inbox.put(new DeliveryKey(message), message);
        long copies = inbox.values().stream().filter(item -> item.getId().equals(message.getId())).count();
        if (copies > 1) log.warn("DELIVERY_REPLAY userId={} msgId={} copies={}", userId, message.getId(), copies);
    }

    public synchronized InboxResult getInbox(String userId, String conversationId) {
        Map<DeliveryKey, Message> inbox = userInboxes.getOrDefault(userId, Map.of());
        List<Message> filtered = new ArrayList<>();
        for (Message msg : inbox.values()) {
            if (conversationId == null || conversationId.equals(msg.getConversationId())) {
                filtered.add(msg);
            }
        }
        return new InboxResult(filtered, filtered.size());
    }

    public synchronized void clear() {
        userInboxes.clear();
    }
}
