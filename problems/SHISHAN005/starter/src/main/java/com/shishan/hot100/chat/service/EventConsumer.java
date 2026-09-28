package com.shishan.hot100.chat.service;

import com.shishan.hot100.chat.model.Message;
import com.shishan.hot100.chat.repository.InboxRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentLinkedQueue;

@Service
public class EventConsumer {
    @Autowired
    private InboxRepository inboxRepository;

    private final ConcurrentLinkedQueue<Message> dispatchQueue = new ConcurrentLinkedQueue<>();

    public void consume(Message message) {
        dispatchQueue.offer(message);
        Message m = dispatchQueue.poll();
        if (m != null) {
            inboxRepository.add("u2", m);
        }
    }
}
