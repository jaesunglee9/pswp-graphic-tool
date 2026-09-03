package com.pswp.graphic.model.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * DTO returned to the client when listing documents.
 * Omits the full {@code content} JSON to keep responses lightweight.
 */
public class DocumentSummary {

    private UUID id;
    private String title;
    private Instant createdAt;
    private Instant updatedAt;

    public DocumentSummary() {}

    public DocumentSummary(UUID id, String title, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.title = title;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}