package com.shishan.hot100.chat.service;

import com.shishan.hot100.chat.model.Message;
import com.shishan.hot100.chat.repository.InboxRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class EventConsumer {
    @Autowired
    private InboxRepository inboxRepository;

    private final List<Message> dispatchQueue = new ArrayList<>();

    public void consume(Message message) {
        dispatchQueue.add(message);
        if (!dispatchQueue.isEmpty()) {
            Message m = dispatchQueue.remove(0);
            inboxRepository.add("u2", m);
        }
    }
}
