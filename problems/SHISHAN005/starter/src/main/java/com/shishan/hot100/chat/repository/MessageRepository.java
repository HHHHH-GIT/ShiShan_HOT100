package com.shishan.hot100.chat.repository;

import com.shishan.hot100.chat.model.Message;
import com.shishan.hot100.chat.model.PageResult;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

@Repository
public class MessageRepository {
    private final AtomicLong idGenerator = new AtomicLong(1000);
    private final List<Message> messages = new ArrayList<>();
    private final Map<String, Message> idempotencyCache = new ConcurrentHashMap<>();

    public Message findByClientMsgId(String clientMsgId) {
        if (clientMsgId == null) {
            return null;
        }
        return idempotencyCache.get(clientMsgId);
    }

    public Message save(Message message) {
        if (message.getId() == null) {
            message.setId(idGenerator.incrementAndGet());
        }
        messages.add(message);
        return message;
    }

    public Message findById(Long id) {
        if (id == null) {
            return null;
        }
        for (Message msg : messages) {
            if (id.equals(msg.getId())) {
                return msg;
            }
        }
        return null;
    }

    public List<Message> findByConversationId(String conversationId) {
        List<Message> result = new ArrayList<>();
        for (Message msg : messages) {
            if (conversationId.equals(msg.getConversationId())) {
                result.add(msg);
            }
        }
        return result;
    }

    public PageResult findHistory(String conversationId, Long before, int limit) {
        List<Message> conversationMessages = new ArrayList<>();
        for (Message msg : messages) {
            if (conversationId.equals(msg.getConversationId())) {
                conversationMessages.add(msg);
            }
        }
        conversationMessages.sort(Comparator.comparingLong(Message::getId).reversed());

        int startIndex = 0;
        if (before != null) {
            for (int i = 0; i < conversationMessages.size(); i++) {
                if (conversationMessages.get(i).getId().equals(before)) {
                    startIndex = i;
                    break;
                }
            }
        }

        List<Message> page = new ArrayList<>();
        for (int i = startIndex; i < conversationMessages.size() && page.size() < limit; i++) {
            page.add(conversationMessages.get(i));
        }

        Long nextCursor = page.isEmpty() ? null : page.get(page.size() - 1).getId();
        boolean hasMore = (startIndex + page.size()) < conversationMessages.size();
        return new PageResult(page, hasMore, nextCursor, conversationMessages.size());
    }

    public List<Message> findUnackedMessages() {
        List<Message> result = new ArrayList<>();
        for (Message msg : messages) {
            if (!msg.isAcked()) {
                result.add(msg);
            }
        }
        return result;
    }

    public void clear() {
        messages.clear();
        idempotencyCache.clear();
        idGenerator.set(1000);
    }
}
