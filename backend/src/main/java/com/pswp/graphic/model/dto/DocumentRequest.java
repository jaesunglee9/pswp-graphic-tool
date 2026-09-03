package com.pswp.graphic.model.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * DTO for creating or updating a document.
 */
public class DocumentRequest {

    @NotBlank(message = "Title is required")
    private String title;

    private String content;

    public DocumentRequest() {}

    public DocumentRequest(String title, String content) {
        this.title = title;
        this.content = content;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}