package com.shishan.hot100.file.model;

public class UploadRequest {
    private String filename;
    private String content;
    private String contentType;

    public UploadRequest() {}

    public UploadRequest(String filename, String content, String contentType) {
        this.filename = filename;
        this.content = content;
        this.contentType = contentType;
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

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }
}
