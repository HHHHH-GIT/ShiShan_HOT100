package com.shishan.hot100.chat.controller;

import com.shishan.hot100.chat.model.ApiResponse;
import com.shishan.hot100.chat.model.Conversation;
import com.shishan.hot100.chat.service.ConversationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
public class ConversationController {
    @Autowired
    private ConversationService conversationService;

    @GetMapping("/{id}")
    public ApiResponse<Conversation> getConversation(@PathVariable String id) {
        Conversation conv = conversationService.getConversation(id);
        if (conv == null) {
            return ApiResponse.error(404, "Conversation not found");
        }
        return ApiResponse.ok(conv);
    }

    @GetMapping
    public ApiResponse<List<Conversation>> listConversations() {
        return ApiResponse.ok(conversationService.listAll());
    }

    @PostMapping("/create")
    public ApiResponse<Conversation> createConversation(
            @RequestParam String name,
            @RequestParam(defaultValue = "GROUP") String type,
            @RequestParam String creatorId
    ) {
        Conversation conv = conversationService.createConversation(name, type, creatorId);
        return ApiResponse.ok(conv);
    }

    @PostMapping("/{id}/mute")
    public ApiResponse<Void> muteConversation(@PathVariable String id, @RequestParam boolean mute) {
        conversationService.muteConversation(id, mute);
        return ApiResponse.ok();
    }
}
