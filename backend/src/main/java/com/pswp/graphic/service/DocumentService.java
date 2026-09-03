package com.pswp.graphic.service;

import com.pswp.graphic.model.Document;
import com.pswp.graphic.model.dto.DocumentRequest;
import com.pswp.graphic.model.dto.DocumentSummary;
import com.pswp.graphic.repository.DocumentRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Service layer for document business logic.
 *
 * <p>Acts as a bridge between REST controllers and the JPA repository.
 * Handles Document → DTO conversion and validation.
 */
@Service
public class DocumentService {

    private final DocumentRepository repository;

    public DocumentService(DocumentRepository repository) {
        this.repository = repository;
    }

    /**
     * Returns a lightweight list of all documents (without content JSON).
     */
    public List<DocumentSummary> listAll() {
        return repository.findAll().stream()
                .map(doc -> new DocumentSummary(
                        doc.getId(),
                        doc.getTitle(),
                        doc.getCreatedAt(),
                        doc.getUpdatedAt()))
                .toList();
    }

    /**
     * Retrieves a single document including its full content JSON.
     *
     * @throws NoSuchElementException if the document does not exist
     */
    public Document getById(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Document not found: " + id));
    }

    /**
     * Creates a new document from the given request.
     * Defaults content to an empty array if not provided.
     */
    public Document create(DocumentRequest request) {
        String content = request.getContent() != null
                ? request.getContent()
                : "[]";
        Document doc = new Document(request.getTitle(), content);
        return repository.save(doc);
    }

    /**
     * Fully replaces a document's title and content.
     *
     * @throws NoSuchElementException if the document does not exist
     */
    public Document update(UUID id, DocumentRequest request) {
        Document doc = getById(id);
        doc.setTitle(request.getTitle());
        if (request.getContent() != null) {
            doc.setContent(request.getContent());
        }
        return repository.save(doc);
    }

    /**
     * Updates only the content JSON field (used by WebSocket collaboration).
     *
     * @throws NoSuchElementException if the document does not exist
     */
    public Document updateContent(UUID id, String content) {
        Document doc = getById(id);
        doc.setContent(content);
        return repository.save(doc);
    }

    /**
     * Deletes a document by ID.
     */
    public void delete(UUID id) {
        if (!repository.existsById(id)) {
            throw new NoSuchElementException("Document not found: " + id);
        }
        repository.deleteById(id);
    }
}