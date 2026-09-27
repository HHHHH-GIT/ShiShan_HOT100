package com.shishan.hot100.file.controller;

import com.shishan.hot100.file.model.ApiResponse;
import com.shishan.hot100.file.model.UploadRequest;
import com.shishan.hot100.file.model.UploadResult;
import com.shishan.hot100.file.service.FileService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;

@RestController
public class FileController {

    private final FileService fileService;

    public FileController(FileService fileService) {
        this.fileService = fileService;
    }

    @GetMapping("/hello")
    public Map<String, String> hello() {
        return Map.of("status", "ok");
    }

    @PostMapping("/api/upload")
    public ApiResponse<UploadResult> upload(@RequestBody UploadRequest request) {
        if (request.getFilename() == null || request.getContent() == null) {
            return ApiResponse.error(400, "filename and content required");
        }
        try {
            UploadResult result = fileService.upload(request);
            return ApiResponse.success(result);
        } catch (Exception e) {
            return ApiResponse.error(500, "upload failed: " + e.getMessage());
        }
    }

    @GetMapping("/api/files/{filename}")
    public ResponseEntity<?> getFile(@PathVariable("filename") String filename) throws IOException {
        byte[] bytes = fileService.loadFile(filename);
        if (bytes == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(ApiResponse.error(404, "file not found"));
        }

        MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
        if (filename.endsWith(".png")) {
            mediaType = MediaType.IMAGE_PNG;
        } else if (filename.endsWith(".txt")) {
            mediaType = MediaType.TEXT_PLAIN;
        }

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .body(bytes);
    }
}
