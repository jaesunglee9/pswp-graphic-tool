package com.pswp.graphic;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the PSWP Graphic Tool backend.
 *
 * <p>This Spring Boot application provides:
 * <ul>
 *   <li>REST API for document CRUD operations</li>
 *   <li>WebSocket-based real-time collaboration</li>
 *   <li>Image upload and asset management</li>
 *   <li>H2 in-memory database (dev) with JPA persistence</li>
 * </ul>
 */
@SpringBootApplication
public class GraphicApplication {

    public static void main(String[] args) {
        SpringApplication.run(GraphicApplication.class, args);
    }
}