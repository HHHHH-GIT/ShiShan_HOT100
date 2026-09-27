package com.shishan.hot100.chat.service;

import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Service
public class ContentModerationService {
    private static final List<String> SENSITIVE_WORDS = Arrays.asList("spam", "phishing", "malware");

    public String sanitize(String content) {
        if (content == null) {
            return "";
        }
        String result = content;
        for (String word : SENSITIVE_WORDS) {
            if (result.toLowerCase().contains(word)) {
                result = result.replaceAll("(?i)" + word, "***");
            }
        }
        return result;
    }

    public boolean isSafe(String content) {
        if (content == null || content.length() > 5000) {
            return false;
        }
        return true;
    }
}
