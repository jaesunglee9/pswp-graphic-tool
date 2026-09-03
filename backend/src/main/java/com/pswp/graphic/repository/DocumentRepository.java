package com.pswp.graphic.repository;

import com.pswp.graphic.model.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * Spring Data JPA repository for {@link Document} entities.
 *
 * <p>Provides standard CRUD operations out of the box:
 * <ul>
 *   <li>{@code findAll()} — list all documents</li>
 *   <li>{@code findById(id)} — get one document</li>
 *   <li>{@code save(document)} — create or update</li>
 *   <li>{@code deleteById(id)} — delete</li>
 * </ul>
 */
@Repository
public interface DocumentRepository extends JpaRepository<Document, UUID> {
}