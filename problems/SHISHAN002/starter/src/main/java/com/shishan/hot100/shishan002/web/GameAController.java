package com.shishan.hot100.shishan002.web;

import com.shishan.hot100.shishan002.domain.BalanceChange;
import com.shishan.hot100.shishan002.dto.ApiResponse;
import com.shishan.hot100.shishan002.dto.RechargeRequest;
import com.shishan.hot100.shishan002.dto.TradeRequest;
import com.shishan.hot100.shishan002.service.WalletService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/gameA")
public class GameAController {

    private static final int YUAN_SCALE = 3;

    private final WalletService walletService;

    public GameAController(WalletService walletService) {
        this.walletService = walletService;
    }

    @GetMapping("/balance/{playerId}")
    public ApiResponse<Object> balance(@PathVariable String playerId) {
        BigDecimal balance = walletService.getBalance(playerId);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("playerId", playerId);
        data.put("balance", balance);
        data.put("unit", "CNY");
        return ApiResponse.success(data);
    }

    @PostMapping("/recharge")
    public ApiResponse<Object> recharge(@RequestBody RechargeRequest request) {
        BalanceChange change = walletService.recharge(request.getPlayerId(), request.getAmount());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("playerId", request.getPlayerId());
        data.put("amount", request.getAmount().setScale(YUAN_SCALE, RoundingMode.HALF_UP));
        data.put("balanceBefore", change.getBalanceBefore());
        data.put("balanceAfter", change.getBalanceAfter());
        data.put("unit", "CNY");
        return ApiResponse.success(data);
    }

    @PostMapping("/trade")
    public ApiResponse<Object> trade(@RequestBody TradeRequest request) {
        BalanceChange change = walletService.trade(request.getPlayerId(), request.getSide(),
                request.getAmount(), request.getBizId());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("playerId", request.getPlayerId());
        data.put("amount", request.getAmount().setScale(YUAN_SCALE, RoundingMode.HALF_UP));
        data.put("side", request.getSide());
        data.put("balanceBefore", change.getBalanceBefore());
        data.put("balanceAfter", change.getBalanceAfter());
        data.put("unit", "CNY");
        return ApiResponse.success(data);
    }

    @GetMapping("/ledger/{playerId}")
    public ApiResponse<Object> ledger(@PathVariable String playerId) {
        return ApiResponse.success(walletService.getLedger(playerId));
    }
}
