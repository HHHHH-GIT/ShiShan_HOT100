package com.shishan.hot100.chat.service;

import com.shishan.hot100.chat.model.Conversation;
import com.shishan.hot100.chat.repository.ConversationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class ConversationService {
    @Autowired
    private ConversationRepository conversationRepository;

    public Conversation getConversation(String conversationId) {
        return conversationRepository.findById(conversationId);
    }

    public Conversation createConversation(String name, String type, String creatorId) {
        String id = "c_" + UUID.randomUUID().toString().substring(0, 8);
        Conversation conv = new Conversation(id, name, type, creatorId);
        conv.getMemberIds().add(creatorId);
        conversationRepository.save(conv);
        return conv;
    }

    public boolean muteConversation(String conversationId, boolean mute) {
        Conversation conv = conversationRepository.findById(conversationId);
        if (conv != null) {
            conv.setMuted(mute);
            conversationRepository.save(conv);
            return true;
        }
        return false;
    }

    public List<Conversation> listAll() {
        return conversationRepository.findAll();
    }
}
