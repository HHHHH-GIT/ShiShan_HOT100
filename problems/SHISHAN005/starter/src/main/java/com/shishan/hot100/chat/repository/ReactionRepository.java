package com.shishan.hot100.chat.repository;

import com.shishan.hot100.chat.model.Reaction;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Repository
public class ReactionRepository {
    private final Map<Long, List<Reaction>> reactionsByMsg = new ConcurrentHashMap<>();

    public void addReaction(Reaction reaction) {
        if (reaction != null && reaction.getMsgId() != null) {
            List<Reaction> list = reactionsByMsg.computeIfAbsent(reaction.getMsgId(), k -> new CopyOnWriteArrayList<>());
            list.removeIf(r -> r.getUserId().equals(reaction.getUserId()) && r.getEmoji().equals(reaction.getEmoji()));
            list.add(reaction);
        }
    }

    public List<Reaction> findByMsgId(Long msgId) {
        if (msgId == null) {
            return new ArrayList<>();
        }
        return new ArrayList<>(reactionsByMsg.getOrDefault(msgId, new ArrayList<>()));
    }

    public void clear() {
        reactionsByMsg.clear();
    }
}
