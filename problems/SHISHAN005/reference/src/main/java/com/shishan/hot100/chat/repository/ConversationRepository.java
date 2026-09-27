package com.shishan.hot100.chat.repository;

import com.shishan.hot100.chat.model.Conversation;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public class ConversationRepository {
    private final Map<String, Conversation> conversationMap = new ConcurrentHashMap<>();

    public ConversationRepository() {
        seedDefaults();
    }

    private void seedDefaults() {
        conversationMap.put("c1", new Conversation("c1", "General Chat", "GROUP", "u1"));
        conversationMap.put("c_page", new Conversation("c_page", "Project Discussion", "CHANNEL", "u1"));
        conversationMap.put("c_flight", new Conversation("c_flight", "Direct Msg", "DIRECT", "u1"));
        conversationMap.put("c_timeline", new Conversation("c_timeline", "Sync Channel", "GROUP", "u1"));
        conversationMap.put("c_load", new Conversation("c_load", "Stress Channel", "GROUP", "u_stress"));
    }

    public Conversation findById(String id) {
        if (id == null) {
            return null;
        }
        return conversationMap.get(id);
    }

    public void save(Conversation conversation) {
        if (conversation != null && conversation.getId() != null) {
            conversationMap.put(conversation.getId(), conversation);
        }
    }

    public List<Conversation> findAll() {
        return new ArrayList<>(conversationMap.values());
    }

    public void clear() {
        conversationMap.clear();
        seedDefaults();
    }
}
