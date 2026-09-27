package com.shishan.hot100.chat.service;

import com.shishan.hot100.chat.model.Message;
import com.shishan.hot100.chat.repository.InboxRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class EventConsumer {
    @Autowired
    private InboxRepository inboxRepository;

    public void consume(Message message) {
        inboxRepository.add("u2", message);
    }
}
