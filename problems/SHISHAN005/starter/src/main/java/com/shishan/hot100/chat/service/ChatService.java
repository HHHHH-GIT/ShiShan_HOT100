package com.shishan.hot100.chat.service;

import com.shishan.hot100.chat.model.AckRequest;
import com.shishan.hot100.chat.model.InboxResult;
import com.shishan.hot100.chat.model.Message;
import com.shishan.hot100.chat.model.PageResult;
import com.shishan.hot100.chat.model.SendRequest;
import com.shishan.hot100.chat.model.TimelineResult;
import com.shishan.hot100.chat.repository.InboxRepository;
import com.shishan.hot100.chat.repository.MessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class ChatService {
    private final AtomicLong sequenceGenerator = new AtomicLong(0);

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private InboxRepository inboxRepository;

    @Autowired
    private EventConsumer eventConsumer;

    public Message sendMessage(SendRequest request) {
        String clientMsgId = request.getClientMsgId();
        if (clientMsgId == null || clientMsgId.trim().isEmpty()) {
            clientMsgId = UUID.randomUUID().toString();
        }

        Message existing = messageRepository.findByClientMsgId(clientMsgId);
        if (existing != null) {
            return existing;
        }

        Message message = new Message(
                null,
                clientMsgId,
                request.getConversationId(),
                request.getSenderId(),
                request.getContent(),
                sequenceGenerator.incrementAndGet(),
                System.currentTimeMillis()
        );

        messageRepository.save(message);
        eventConsumer.consume(message);
        return message;
    }

    public boolean ackMessage(AckRequest request) {
        Message message = messageRepository.findById(request.getMsgId());
        if (message != null) {
            message.setAcked(true);
            message.setAckedAt(System.currentTimeMillis());
            messageRepository.registerAck(message.getClientMsgId(), message);
            return true;
        }
        return false;
    }

    public InboxResult getInbox(String userId, String conversationId) {
        return inboxRepository.getInbox(userId, conversationId);
    }

    public PageResult getHistory(String conversationId, Long before, int limit) {
        return messageRepository.findHistory(conversationId, before, limit);
    }

    public TimelineResult getTimeline(String conversationId, String userId) {
        List<Message> history = messageRepository.findByConversationId(conversationId);
        List<Message> inbox = inboxRepository.getInbox(userId, conversationId).getMessages();

        List<Message> combined = new ArrayList<>();
        combined.addAll(history);
        combined.addAll(inbox);
        combined.sort(Comparator.comparingLong(Message::getId));

        return new TimelineResult(combined, combined.size());
    }

    public void reset() {
        messageRepository.clear();
        inboxRepository.clear();
        sequenceGenerator.set(0);
    }
}
