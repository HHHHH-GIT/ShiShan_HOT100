package com.shishan.hot100.file.model;

public class FileMeta {
    private String fileId;
    private String filename;
    private long size;
    private String hash;
    private String contentType;
    private long uploadedAt;

    public FileMeta() {}

    public FileMeta(String fileId, String filename, long size, String hash, String contentType, long uploadedAt) {
        this.fileId = fileId;
        this.filename = filename;
        this.size = size;
        this.hash = hash;
        this.contentType = contentType;
        this.uploadedAt = uploadedAt;
    }

    public String getFileId() {
        return fileId;
    }

    public void setFileId(String fileId) {
        this.fileId = fileId;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public long getSize() {
        return size;
    }

    public void setSize(long size) {
        this.size = size;
    }

    public String getHash() {
        return hash;
    }

    public void setHash(String hash) {
        this.hash = hash;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public long getUploadedAt() {
        return uploadedAt;
    }

    public void setUploadedAt(long uploadedAt) {
        this.uploadedAt = uploadedAt;
    }
}
