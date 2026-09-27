package com.shishan.hot100.chat.controller;

import com.shishan.hot100.chat.model.ApiResponse;
import com.shishan.hot100.chat.model.Reaction;
import com.shishan.hot100.chat.model.ReactionRequest;
import com.shishan.hot100.chat.service.ReactionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/chat/reaction")
public class ReactionController {
    @Autowired
    private ReactionService reactionService;

    @PostMapping
    public ApiResponse<Void> addReaction(@RequestBody ReactionRequest request) {
        reactionService.addReaction(request);
        return ApiResponse.ok();
    }

    @GetMapping
    public ApiResponse<List<Reaction>> getReactions(@RequestParam Long msgId) {
        return ApiResponse.ok(reactionService.getReactions(msgId));
    }
}
