package com.shishan.hot100.file.model;

public class UploadRequest {
    private String filename;
    private String content;

    public UploadRequest() {}

    public UploadRequest(String filename, String content) {
        this.filename = filename;
        this.content = content;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
