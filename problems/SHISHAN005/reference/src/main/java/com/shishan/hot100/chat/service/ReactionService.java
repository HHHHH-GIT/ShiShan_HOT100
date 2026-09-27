package com.shishan.hot100.chat.service;

import com.shishan.hot100.chat.model.Reaction;
import com.shishan.hot100.chat.model.ReactionRequest;
import com.shishan.hot100.chat.repository.ReactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ReactionService {
    @Autowired
    private ReactionRepository reactionRepository;

    public void addReaction(ReactionRequest request) {
        if (request != null && request.getMsgId() != null && request.getEmoji() != null) {
            Reaction reaction = new Reaction(request.getMsgId(), request.getUserId(), request.getEmoji());
            reactionRepository.addReaction(reaction);
        }
    }

    public List<Reaction> getReactions(Long msgId) {
        return reactionRepository.findByMsgId(msgId);
    }
}
