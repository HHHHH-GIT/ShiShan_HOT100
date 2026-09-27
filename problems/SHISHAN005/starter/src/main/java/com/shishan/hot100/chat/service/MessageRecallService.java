package com.shishan.hot100.chat.service;

import com.shishan.hot100.chat.model.Message;
import com.shishan.hot100.chat.model.RecallRequest;
import com.shishan.hot100.chat.repository.MessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class MessageRecallService {
    private static final long MAX_RECALL_TIME_MS = 120_000;

    @Autowired
    private MessageRepository messageRepository;

    public boolean recallMessage(RecallRequest request) {
        if (request == null || request.getMsgId() == null) {
            return false;
        }
        Message message = messageRepository.findById(request.getMsgId());
        if (message == null) {
            return false;
        }

        long now = System.currentTimeMillis();
        if (now - message.getCreatedAt() > MAX_RECALL_TIME_MS) {
            return false;
        }

        message.setContent("[消息已撤回]");
        return true;
    }
}
