package com.shishan.hot100.shishan002.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class UnitConverter {

    public static final BigDecimal THOUSAND = new BigDecimal("1000");

    private UnitConverter() {
    }

    public static long toRaw(BigDecimal yuan) {
        return yuan.multiply(THOUSAND).setScale(0, RoundingMode.HALF_UP).longValueExact();
    }

    public static BigDecimal toYuan(long raw) {
        return BigDecimal.valueOf(raw).divide(THOUSAND).setScale(3, RoundingMode.HALF_UP);
    }
}
