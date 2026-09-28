package com.shishan.hot100.chat.repository;

import com.shishan.hot100.chat.model.Message;
import java.util.Objects;

final class DeliveryKey {
    private final Long messageId;

    DeliveryKey(Message source) {
        this.messageId = source.getId();
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(messageId);
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof DeliveryKey key && Objects.equals(messageId, key.messageId);
    }
}
