package com.shishan.hot100.file.service;

import com.shishan.hot100.file.model.UploadRequest;
import com.shishan.hot100.file.model.UploadResult;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Base64;

@Service
public class FileService {

    private final File uploadDir = new File("src/main/resources/static/uploads");

    public FileService() {
        if (!uploadDir.exists()) {
            uploadDir.mkdirs();
        }
    }

    public UploadResult upload(UploadRequest request) throws IOException {
        byte[] bytes = Base64.getDecoder().decode(request.getContent());
        File dest = new File(uploadDir, request.getFilename());
        Files.write(dest.toPath(), bytes);
        return new UploadResult(request.getFilename(), "/api/files/" + request.getFilename());
    }

    public byte[] loadFile(String filename) throws IOException {
        Resource resource = new ClassPathResource("static/uploads/" + filename);
        if (!resource.exists()) {
            return null;
        }
        return resource.getContentAsByteArray();
    }
}
