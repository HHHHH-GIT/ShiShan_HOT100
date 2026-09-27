package com.shishan.hot100.file.service;

import com.shishan.hot100.file.model.FileMeta;
import com.shishan.hot100.file.model.UploadRequest;
import com.shishan.hot100.file.util.HashUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);
    private final File storageDir = new File("storage");

    private final Map<String, FileMeta> metaIndex = new ConcurrentHashMap<>();

    public FileStorageService() {
        if (!storageDir.exists()) {
            storageDir.mkdirs();
        }
    }

    public FileMeta saveFile(UploadRequest request) throws IOException {
        String rawContent = request.getContent() != null ? request.getContent().trim() : "";

        rawContent = rawContent.replace(' ', '+');
        byte[] fileBytes = Base64.getDecoder().decode(rawContent);

        String hash = HashUtils.calculateSha256(fileBytes);
        String fileId = UUID.randomUUID().toString().replace("-", "");

        File destFile = new File(storageDir, hash);

        Files.write(destFile.toPath(), fileBytes);

        FileMeta meta = new FileMeta(
                fileId,
                request.getFilename(),
                fileBytes.length,
                hash,
                request.getContentType(),
                System.currentTimeMillis()
        );

        metaIndex.put(hash, meta);
        log.info("文件上传完成 fileId={} hash={}", fileId, hash);
        return meta;
    }

    public FileMeta getMeta(String hash) {
        if (hash == null) {
            return null;
        }

        String lookupKey = hash.toLowerCase();
        return metaIndex.get(lookupKey);
    }

    public byte[] getFileBytes(String hash) throws IOException {
        FileMeta meta = getMeta(hash);
        if (meta == null) {
            return null;
        }
        File targetFile = new File(storageDir, hash);
        if (!targetFile.exists()) {
            return null;
        }
        return Files.readAllBytes(targetFile.toPath());
    }
}
