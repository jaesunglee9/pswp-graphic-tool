/**
 * Document API — CRUD operations for graphic documents.
 *
 * Communicates with the Spring Boot backend at /api/documents.
 */
import { apiClient } from '@/api/client';

export interface DocumentSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  title: string;
  content: string; // JSON string of GraphicObjectInterface[]
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRequest {
  title: string;
  content?: string;
}

/** List all documents (summaries only, no content). */
export async function listDocuments(): Promise<DocumentSummary[]> {
  return apiClient.get<DocumentSummary[]>('/api/documents');
}

/** Get a single document by ID (includes full content JSON). */
export async function getDocument(id: string): Promise<Document> {
  return apiClient.get<Document>(`/api/documents/${id}`);
}

/** Create a new document. */
export async function createDocument(title: string, content?: string): Promise<Document> {
  return apiClient.post<Document>('/api/documents', { title, content } satisfies DocumentRequest);
}

/** Update a document's title and/or content. */
export async function updateDocument(id: string, request: DocumentRequest): Promise<Document> {
  return apiClient.put<Document>(`/api/documents/${id}`, request);
}

/** Delete a document. */
export async function deleteDocument(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/documents/${id}`);
}