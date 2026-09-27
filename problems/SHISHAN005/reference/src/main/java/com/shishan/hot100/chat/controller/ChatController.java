package com.shishan.hot100.chat.controller;

import com.shishan.hot100.chat.model.AckRequest;
import com.shishan.hot100.chat.model.ApiResponse;
import com.shishan.hot100.chat.model.InboxResult;
import com.shishan.hot100.chat.model.Message;
import com.shishan.hot100.chat.model.PageResult;
import com.shishan.hot100.chat.model.RecallRequest;
import com.shishan.hot100.chat.model.SendRequest;
import com.shishan.hot100.chat.model.TimelineResult;
import com.shishan.hot100.chat.service.ChatService;
import com.shishan.hot100.chat.service.CompensationWorker;
import com.shishan.hot100.chat.service.MessageRecallService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatController {
    @Autowired
    private ChatService chatService;

    @Autowired
    private CompensationWorker compensationWorker;

    @Autowired
    private MessageRecallService messageRecallService;

    @PostMapping("/send")
    public ApiResponse<Message> sendMessage(@RequestBody SendRequest request) {
        Message message = chatService.sendMessage(request);
        return ApiResponse.ok(message);
    }

    @PostMapping("/ack")
    public ApiResponse<Map<String, Object>> ackMessage(@RequestBody AckRequest request) {
        boolean acked = chatService.ackMessage(request);
        return ApiResponse.ok(Collections.singletonMap("acked", acked));
    }

    @GetMapping("/inbox")
    public ApiResponse<InboxResult> getInbox(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String conversationId
    ) {
        String uid = userId != null ? userId : "u2";
        InboxResult inbox = chatService.getInbox(uid, conversationId);
        return ApiResponse.ok(inbox);
    }

    @GetMapping("/history")
    public ApiResponse<PageResult> getHistory(
            @RequestParam String conversationId,
            @RequestParam(required = false) Long before,
            @RequestParam(defaultValue = "10") int limit
    ) {
        PageResult history = chatService.getHistory(conversationId, before, limit);
        return ApiResponse.ok(history);
    }

    @GetMapping("/timeline")
    public ApiResponse<TimelineResult> getTimeline(
            @RequestParam String conversationId,
            @RequestParam(required = false) String userId
    ) {
        String uid = userId != null ? userId : "u2";
        TimelineResult timeline = chatService.getTimeline(conversationId, uid);
        return ApiResponse.ok(timeline);
    }

    @PostMapping("/recall")
    public ApiResponse<Map<String, Object>> recallMessage(@RequestBody RecallRequest request) {
        boolean success = messageRecallService.recallMessage(request);
        return ApiResponse.ok(Collections.singletonMap("recalled", success));
    }

    @PostMapping("/compensate")
    public ApiResponse<Map<String, Object>> compensate() {
        int count = compensationWorker.runCompensation();
        return ApiResponse.ok(Collections.singletonMap("compensatedCount", count));
    }

    @PostMapping("/reset")
    public ApiResponse<Void> reset() {
        chatService.reset();
        return ApiResponse.ok();
    }
}
