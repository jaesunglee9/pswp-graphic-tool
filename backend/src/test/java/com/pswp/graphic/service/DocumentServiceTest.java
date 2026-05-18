package com.pswp.graphic.service;

import com.pswp.graphic.model.Document;
import com.pswp.graphic.model.dto.DocumentRequest;
import com.pswp.graphic.model.dto.DocumentSummary;
import com.pswp.graphic.repository.DocumentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentServiceTest {

    @Mock
    private DocumentRepository repository;

    private DocumentService service;

    @BeforeEach
    void setUp() {
        service = new DocumentService(repository);
    }

    @Test
    void listAll_ReturnsEmptyList_WhenNoDocuments() {
        when(repository.findAll()).thenReturn(List.of());
        List<DocumentSummary> result = service.listAll();
        assertTrue(result.isEmpty());
    }

    @Test
    void listAll_ReturnsSummaries() {
        Document doc = new Document("Test Doc", "[]");
        setId(doc, UUID.randomUUID());
        setTimestamps(doc);

        when(repository.findAll()).thenReturn(List.of(doc));

        List<DocumentSummary> result = service.listAll();
        assertEquals(1, result.size());
        assertEquals("Test Doc", result.get(0).getTitle());
    }

    @Test
    void getById_ReturnsDocument_WhenFound() {
        UUID id = UUID.randomUUID();
        Document doc = new Document("Doc", "[]");
        setId(doc, id);
        setTimestamps(doc);

        when(repository.findById(id)).thenReturn(Optional.of(doc));

        Document result = service.getById(id);
        assertEquals("Doc", result.getTitle());
    }

    @Test
    void getById_Throws_WhenNotFound() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());
        assertThrows(NoSuchElementException.class, () -> service.getById(id));
    }

    @Test
    void create_SavesNewDocument() {
        DocumentRequest request = new DocumentRequest("New Doc", "[]");
        Document saved = new Document("New Doc", "[]");
        setId(saved, UUID.randomUUID());
        setTimestamps(saved);

        when(repository.save(any(Document.class))).thenReturn(saved);

        Document result = service.create(request);
        assertEquals("New Doc", result.getTitle());
        verify(repository).save(any(Document.class));
    }

    @Test
    void create_DefaultsContentToEmptyArray() {
        DocumentRequest request = new DocumentRequest("Empty", null);
        Document saved = new Document("Empty", "[]");
        setId(saved, UUID.randomUUID());
        setTimestamps(saved);

        when(repository.save(any(Document.class))).thenReturn(saved);

        Document result = service.create(request);
        assertEquals("[]", result.getContent());
    }

    @Test
    void update_ModifiesTitleAndContent() {
        UUID id = UUID.randomUUID();
        Document existing = new Document("Old", "[]");
        setId(existing, id);
        setTimestamps(existing);

        DocumentRequest request = new DocumentRequest("Updated", "[{}]");

        when(repository.findById(id)).thenReturn(Optional.of(existing));
        when(repository.save(any(Document.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Document result = service.update(id, request);
        assertEquals("Updated", result.getTitle());
        assertEquals("[{}]", result.getContent());
    }

    @Test
    void delete_RemovesDocument() {
        UUID id = UUID.randomUUID();
        when(repository.existsById(id)).thenReturn(true);

        service.delete(id);
        verify(repository).deleteById(id);
    }

    @Test
    void delete_Throws_WhenNotFound() {
        UUID id = UUID.randomUUID();
        when(repository.existsById(id)).thenReturn(false);
        assertThrows(NoSuchElementException.class, () -> service.delete(id));
    }

    @Test
    void updateContent_OnlyUpdatesContent() {
        UUID id = UUID.randomUUID();
        Document existing = new Document("Doc", "[]");
        setId(existing, id);
        setTimestamps(existing);

        when(repository.findById(id)).thenReturn(Optional.of(existing));
        when(repository.save(any(Document.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Document result = service.updateContent(id, "[{ \"type\": \"rectangle\" }]");
        assertEquals("Doc", result.getTitle());
        assertEquals("[{ \"type\": \"rectangle\" }]", result.getContent());
    }

    // --- Helpers to set private fields via reflection ---

    private void setId(Document doc, UUID id) {
        try {
            Field field = Document.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(doc, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private void setTimestamps(Document doc) {
        try {
            Instant now = Instant.now();
            Field createdAtField = Document.class.getDeclaredField("createdAt");
            createdAtField.setAccessible(true);
            createdAtField.set(doc, now);
            Field updatedAtField = Document.class.getDeclaredField("updatedAt");
            updatedAtField.setAccessible(true);
            updatedAtField.set(doc, now);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}