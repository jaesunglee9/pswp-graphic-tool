package com.pswp.graphic.controller;

import com.pswp.graphic.GraphicApplication;
import com.pswp.graphic.model.Document;
import com.pswp.graphic.repository.DocumentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Full integration test: starts the Spring Boot application with an in-memory H2 database
 * and tests the full REST API lifecycle.
 */
@SpringBootTest(
    classes = GraphicApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT
)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1"
})
class DocumentIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DocumentRepository repository;

    @BeforeEach
    void setUp() {
        repository.deleteAll();
    }

    @Test
    void fullCrudLifecycle() throws Exception {
        // 1. List — starts empty
        mockMvc.perform(get("/api/documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        // 2. Create
        MvcResult createResult = mockMvc.perform(post("/api/documents")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"My Drawing\", \"content\": \"[]\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("My Drawing"))
                .andExpect(jsonPath("$.content").value("[]"))
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andReturn();

        String responseBody = createResult.getResponse().getContentAsString();
        String id = extractId(responseBody);

        // 3. Get by ID
        mockMvc.perform(get("/api/documents/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("My Drawing"))
                .andExpect(jsonPath("$.content").value("[]"));

        // 4. List — should have 1 entry
        mockMvc.perform(get("/api/documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isNotEmpty())
                .andExpect(jsonPath("$[0].title").value("My Drawing"));

        // 5. Update
        mockMvc.perform(put("/api/documents/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"Updated Drawing\", \"content\": \"[{}]\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Updated Drawing"))
                .andExpect(jsonPath("$.content").value("[{}]"));

        // 6. Delete
        mockMvc.perform(delete("/api/documents/{id}", id))
                .andExpect(status().isNoContent());

        // 7. List — empty again
        mockMvc.perform(get("/api/documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        // 8. Get deleted returns 404
        mockMvc.perform(get("/api/documents/{id}", id))
                .andExpect(status().isNotFound());
    }

    @Test
    void createMultipleDocuments() throws Exception {
        mockMvc.perform(post("/api/documents")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"Doc 1\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/documents")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"Doc 2\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void createWithoutTitle_Returns400() throws Exception {
        mockMvc.perform(post("/api/documents")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    /**
     * Extracts the "id" field from a JSON response body.
     */
    private String extractId(String json) {
        // Simple JSON parsing for the id field
        String key = "\"id\":\"";
        int start = json.indexOf(key);
        if (start == -1) return "";
        start += key.length();
        int end = json.indexOf("\"", start);
        return json.substring(start, end);
    }
}