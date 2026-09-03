package com.pswp.graphic.controller;

import com.pswp.graphic.model.Document;
import com.pswp.graphic.model.dto.DocumentRequest;
import com.pswp.graphic.model.dto.DocumentSummary;
import com.pswp.graphic.service.DocumentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(DocumentController.class)
class DocumentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DocumentService documentService;

    @Test
    void listDocuments_Returns200() throws Exception {
        when(documentService.listAll()).thenReturn(List.of(
                new DocumentSummary(UUID.randomUUID(), "Doc 1", Instant.now(), Instant.now())
        ));

        mockMvc.perform(get("/api/documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Doc 1"));
    }

    @Test
    void getDocument_Returns200_WhenFound() throws Exception {
        UUID id = UUID.randomUUID();
        Document doc = new Document("My Doc", "[{}]");
        setId(doc, id);
        setTimestamps(doc);

        when(documentService.getById(id)).thenReturn(doc);

        mockMvc.perform(get("/api/documents/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("My Doc"))
                .andExpect(jsonPath("$.content").value("[{}]"));
    }

    @Test
    void getDocument_Returns404_WhenNotFound() throws Exception {
        UUID id = UUID.randomUUID();
        when(documentService.getById(id)).thenThrow(new NoSuchElementException("Not found"));

        mockMvc.perform(get("/api/documents/{id}", id))
                .andExpect(status().isNotFound());
    }

    @Test
    void createDocument_Returns201() throws Exception {
        Document created = new Document("New Doc", "[]");
        setId(created, UUID.randomUUID());
        setTimestamps(created);

        when(documentService.create(any(DocumentRequest.class))).thenReturn(created);

        mockMvc.perform(post("/api/documents")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"New Doc\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("New Doc"));
    }

    @Test
    void createDocument_Returns400_WhenTitleMissing() throws Exception {
        mockMvc.perform(post("/api/documents")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateDocument_Returns200() throws Exception {
        UUID id = UUID.randomUUID();
        Document updated = new Document("Updated", "[{}]");
        setId(updated, id);
        setTimestamps(updated);

        when(documentService.update(eq(id), any(DocumentRequest.class))).thenReturn(updated);

        mockMvc.perform(put("/api/documents/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"Updated\", \"content\": \"[{}]\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Updated"));
    }

    @Test
    void updateDocument_Returns404_WhenNotFound() throws Exception {
        UUID id = UUID.randomUUID();
        when(documentService.update(eq(id), any(DocumentRequest.class)))
                .thenThrow(new NoSuchElementException("Not found"));

        mockMvc.perform(put("/api/documents/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"Updated\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteDocument_Returns204() throws Exception {
        UUID id = UUID.randomUUID();
        doNothing().when(documentService).delete(id);

        mockMvc.perform(delete("/api/documents/{id}", id))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteDocument_Returns404_WhenNotFound_WhenNotFound() throws Exception {
        UUID id = UUID.randomUUID();
        doThrow(new NoSuchElementException("Not found")).when(documentService).delete(id);

        mockMvc.perform(delete("/api/documents/{id}", id))
                .andExpect(status().isNotFound());
    }

    // --- Helpers ---

    private void setId(Document doc, UUID id) {
        try {
            var field = Document.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(doc, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private void setTimestamps(Document doc) {
        try {
            Instant now = Instant.now();
            var createdAtField = Document.class.getDeclaredField("createdAt");
            createdAtField.setAccessible(true);
            createdAtField.set(doc, now);
            var updatedAtField = Document.class.getDeclaredField("updatedAt");
            updatedAtField.setAccessible(true);
            updatedAtField.set(doc, now);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}