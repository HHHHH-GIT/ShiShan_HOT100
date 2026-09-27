package com.shishan.hot100.shishan002.web;

import com.shishan.hot100.shishan002.dto.ApiResponse;
import com.shishan.hot100.shishan002.exception.BusinessException;
import com.shishan.hot100.shishan002.repository.LedgerRepository;
import com.shishan.hot100.shishan002.service.UnitConverter;
import com.shishan.hot100.shishan002.service.WalletService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/gameB")
public class GameBController {

    private static final Logger logger = LoggerFactory.getLogger(GameBController.class);

    private final WalletService walletService;

    private final LedgerRepository ledgerRepository;

    public GameBController(WalletService walletService, LedgerRepository ledgerRepository) {
        this.walletService = walletService;
        this.ledgerRepository = ledgerRepository;
    }

    @GetMapping("/balance/{playerId}")
    public ApiResponse<Object> balance(@PathVariable String playerId) {
        long raw = ledgerRepository.getBalanceRaw(playerId);
        BigDecimal converted = UnitConverter.toYuan(raw);
        BigDecimal balance = walletService.getBalance(playerId).divide(UnitConverter.THOUSAND);
        logger.debug("gameB read balance playerId={}, raw={}, converted={}, returned={}", playerId, raw, converted, balance);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("playerId", playerId);
        data.put("balance", balance);
        data.put("unit", "CNY");
        return ApiResponse.success(data);
    }

    @GetMapping("/balances")
    public ApiResponse<Object> balances(@RequestParam(required = false) String playerIds) {
        if (playerIds == null || playerIds.isBlank()) {
            throw new BusinessException(400, "playerIds不能为空");
        }
        List<Map<String, Object>> balances = new ArrayList<>();
        for (String pid : playerIds.split(",")) {

            BigDecimal balance = walletService.getBalance(pid).divide(UnitConverter.THOUSAND);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("playerId", pid);
            item.put("balance", balance);
            balances.add(item);
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("unit", "CNY");
        data.put("balances", balances);
        return ApiResponse.success(data);
    }
}
