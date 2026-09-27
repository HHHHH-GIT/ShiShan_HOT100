package com.shishan.hot100.chat.service;

import com.shishan.hot100.chat.model.Message;
import com.shishan.hot100.chat.repository.MessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class CompensationWorker {
    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private EventConsumer eventConsumer;

    public int runCompensation() {
        List<Message> unacked = messageRepository.findUnackedMessages();
        int count = 0;
        for (Message msg : unacked) {
            eventConsumer.consume(msg);
            count++;
        }
        return count;
    }
}
