package com.shishan.hot100.chat.service;

import com.shishan.hot100.chat.model.Message;
import com.shishan.hot100.chat.repository.MessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class CompensationWorker {
    private static final long TIMEOUT_THRESHOLD_MS = 3000;

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private EventConsumer eventConsumer;

    public int runCompensation() {
        long now = System.currentTimeMillis();
        List<Message> unacked = messageRepository.findUnackedMessages();
        int count = 0;
        for (Message msg : unacked) {
            if (now - msg.getCreatedAt() < TIMEOUT_THRESHOLD_MS) {
                eventConsumer.consume(msg);
                count++;
            }
        }
        return count;
    }
}
