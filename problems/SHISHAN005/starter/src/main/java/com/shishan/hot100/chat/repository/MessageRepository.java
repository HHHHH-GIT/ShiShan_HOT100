package com.shishan.hot100.chat.repository;

import com.shishan.hot100.chat.model.Message;
import com.shishan.hot100.chat.model.PageResult;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

@Repository
public class MessageRepository {
    private final AtomicLong idGenerator = new AtomicLong(1000);
    private final List<Message> messages = new CopyOnWriteArrayList<>();

    public Message findByClientMsgId(String clientMsgId) {
        if (clientMsgId == null) {
            return null;
        }
        for (Message msg : messages) {
            if (clientMsgId.equals(msg.getClientMsgId()) && msg.isAcked()) {
                return msg;
            }
        }
        return null;
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
        List<Message> filtered = new ArrayList<>();
        int total = 0;
        for (Message msg : messages) {
            if (conversationId.equals(msg.getConversationId())) {
                total++;
                if (before == null || msg.getId() <= before) {
                    filtered.add(msg);
                }
            }
        }
        filtered.sort((a, b) -> Long.compare(b.getId(), a.getId()));

        List<Message> page = new ArrayList<>();
        for (int i = 0; i < filtered.size() && i < limit; i++) {
            page.add(filtered.get(i));
        }

        Long nextCursor = page.isEmpty() ? null : page.get(page.size() - 1).getId();
        boolean hasMore = filtered.size() > limit;
        return new PageResult(page, hasMore, nextCursor, total);
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
        idGenerator.set(1000);
    }
}
