/**
 * Tests for the document API functions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listDocuments, getDocument, createDocument, updateDocument, deleteDocument } from '@/api/documentApi';

describe('documentApi', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('listDocuments fetches and returns summaries', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([
        { id: '1', title: 'Doc 1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      ]),
    } as Response);

    const docs = await listDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].title).toBe('Doc 1');
  });

  it('getDocument fetches a single document with content', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: '1', title: 'Doc', content: '[]', createdAt: '', updatedAt: '' }),
    } as Response);

    const doc = await getDocument('1');
    expect(doc.id).toBe('1');
    expect(doc.content).toBe('[]');
  });

  it('createDocument sends POST and returns new document', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: '2', title: 'New', content: '[]', createdAt: '', updatedAt: '' }),
    } as Response);

    const doc = await createDocument('New', '[]');
    expect(doc.id).toBe('2');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/documents',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'New', content: '[]' }),
      }),
    );
  });

  it('updateDocument sends PUT and returns updated document', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: '1', title: 'Updated', content: '[]', createdAt: '', updatedAt: '' }),
    } as Response);

    const doc = await updateDocument('1', { title: 'Updated' });
    expect(doc.title).toBe('Updated');
  });

  it('deleteDocument sends DELETE', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: () => Promise.resolve(),
    } as Response);

    await deleteDocument('1');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/documents/1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});