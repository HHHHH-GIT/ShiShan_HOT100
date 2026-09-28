package com.shishan.hot100.chat.repository;

import com.shishan.hot100.chat.model.Message;
import com.shishan.hot100.chat.model.PageResult;
import org.springframework.stereotype.Repository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

@Repository
public class MessageRepository {
    private static final Logger log = LoggerFactory.getLogger(MessageRepository.class);
    private final AtomicLong idGenerator = new AtomicLong(1000);
    private final List<Message> messages = new CopyOnWriteArrayList<>();
    private final RecentMessageIndex recentMessages = new RecentMessageIndex();

    public Message findByClientMsgId(String clientMsgId) {
        if (clientMsgId == null) {
            return null;
        }
        Message cached = recentMessages.get(clientMsgId);
        return cached != null && clientMsgId.equals(cached.getClientMsgId()) ? cached : null;
    }

    public Message save(Message message) {
        if (message.getId() == null) {
            message.setId(idGenerator.incrementAndGet());
        }
        for (Message stored : messages) {
            if (message.getClientMsgId() != null && message.getClientMsgId().equals(stored.getClientMsgId())) {
                log.warn("MESSAGE_REPLAY clientMsgId={} previous={} current={}", message.getClientMsgId(), stored.getId(), message.getId());
                break;
            }
        }
        messages.add(message);
        recentMessages.put(message);
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
        recentMessages.clear();
        idGenerator.set(1000);
    }
}
