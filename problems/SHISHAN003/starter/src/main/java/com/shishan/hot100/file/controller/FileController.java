package com.shishan.hot100.file.controller;

import com.shishan.hot100.file.model.ApiResponse;
import com.shishan.hot100.file.model.FileMeta;
import com.shishan.hot100.file.model.UploadRequest;
import com.shishan.hot100.file.service.FileStorageService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;

@RestController
public class FileController {

    private final FileStorageService storageService;

    public FileController(FileStorageService storageService) {
        this.storageService = storageService;
    }

    @GetMapping("/hello")
    public Map<String, String> hello() {
        return Map.of("status", "ok");
    }

    @PostMapping("/api/files/upload")
    public ApiResponse<FileMeta> upload(@RequestBody UploadRequest request) {
        if (request.getFilename() == null || request.getContent() == null) {
            return ApiResponse.error(400, "filename and content required");
        }
        try {
            FileMeta meta = storageService.saveFile(request);
            return ApiResponse.success(meta);
        } catch (Exception e) {
            return ApiResponse.error(500, "upload failed: " + e.getMessage());
        }
    }

    @GetMapping("/api/files/{hash}")
    public ResponseEntity<ApiResponse<FileMeta>> getMeta(@PathVariable("hash") String hash) {
        FileMeta meta = storageService.getMeta(hash);
        if (meta == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(404, "file not found"));
        }
        return ResponseEntity.ok(ApiResponse.success(meta));
    }

    @GetMapping("/api/files/{hash}/download")
    public ResponseEntity<byte[]> download(@PathVariable("hash") String hash) throws IOException {
        FileMeta meta = storageService.getMeta(hash);
        if (meta == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        byte[] bytes = storageService.getFileBytes(hash);
        if (bytes == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
        if (meta.getContentType() != null && !meta.getContentType().isBlank()) {
            try {
                mediaType = MediaType.parseMediaType(meta.getContentType());
            } catch (Exception ignored) {
            }
        }

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + meta.getFilename() + "\"")
                .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(bytes.length))
                .body(bytes);
    }
}
