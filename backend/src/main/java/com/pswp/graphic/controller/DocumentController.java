package com.pswp.graphic.controller;

import com.pswp.graphic.model.Document;
import com.pswp.graphic.model.dto.DocumentRequest;
import com.pswp.graphic.model.dto.DocumentSummary;
import com.pswp.graphic.service.DocumentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for document management.
 *
 * <p>Exposes CRUD endpoints under {@code /api/documents}:
 * <ul>
 *   <li>{@code GET /api/documents} — list all documents (summaries)</li>
 *   <li>{@code POST /api/documents} — create a new document</li>
 *   <li>{@code GET /api/documents/{id}} — get a single document with content</li>
 *   <li>{@code PUT /api/documents/{id}} — update title and/or content</li>
 *   <li>{@code DELETE /api/documents/{id}} — delete a document</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @GetMapping
    public ResponseEntity<List<DocumentSummary>> listDocuments() {
        return ResponseEntity.ok(documentService.listAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Document> getDocument(@PathVariable UUID id) {
        return ResponseEntity.ok(documentService.getById(id));
    }

    @PostMapping
    public ResponseEntity<Document> createDocument(@Valid @RequestBody DocumentRequest request) {
        Document created = documentService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Document> updateDocument(
            @PathVariable UUID id,
            @Valid @RequestBody DocumentRequest request) {
        Document updated = documentService.update(id, request);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDocument(@PathVariable UUID id) {
        documentService.delete(id);
        return ResponseEntity.noContent().build();
    }
}