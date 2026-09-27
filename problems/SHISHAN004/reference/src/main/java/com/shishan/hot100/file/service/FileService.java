package com.shishan.hot100.file.service;

import com.shishan.hot100.file.model.UploadRequest;
import com.shishan.hot100.file.model.UploadResult;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Base64;

@Service
public class FileService {

    private final File storageDir = new File("uploads");

    public FileService() {
        if (!storageDir.exists()) {
            storageDir.mkdirs();
        }
    }

    public UploadResult upload(UploadRequest request) throws IOException {
        byte[] bytes = Base64.getDecoder().decode(request.getContent());
        File dest = new File(storageDir, request.getFilename());
        Files.write(dest.toPath(), bytes);
        return new UploadResult(request.getFilename(), "/api/files/" + request.getFilename());
    }

    public byte[] loadFile(String filename) throws IOException {
        File target = new File(storageDir, filename);
        if (!target.exists() || !target.isFile()) {
            return null;
        }
        return Files.readAllBytes(target.toPath());
    }
}
