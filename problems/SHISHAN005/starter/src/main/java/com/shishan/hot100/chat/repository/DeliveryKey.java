package com.shishan.hot100.chat.repository;

import com.shishan.hot100.chat.model.Message;
import java.util.Objects;

final class DeliveryKey {
    private final Message source;

    DeliveryKey(Message source) {
        this.source = source;
    }

    @Override
    public int hashCode() {
        return Objects.hash(source.getId(), source.getContent(), source.isAcked());
    }

    @Override
    public boolean equals(Object other) {
        if (!(other instanceof DeliveryKey key)) return false;
        return Objects.equals(source.getId(), key.source.getId())
                && Objects.equals(source.getContent(), key.source.getContent())
                && source.isAcked() == key.source.isAcked();
    }
}
