package com.shishan.hot100.file.model;

public class UploadResult {
    private String filename;
    private String url;

    public UploadResult() {}

    public UploadResult(String filename, String url) {
        this.filename = filename;
        this.url = url;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }
}
