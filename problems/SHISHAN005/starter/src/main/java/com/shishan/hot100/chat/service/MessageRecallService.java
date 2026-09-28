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

    @Autowired
    private EventConsumer eventConsumer;

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

        // 撤回沿用原消息编号，向接收端发布原气泡的更新。
        message.setContent("[消息已撤回]");
        eventConsumer.consume(message);
        return true;
    }
}
