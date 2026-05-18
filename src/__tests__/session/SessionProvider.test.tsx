/**
 * Smoke tests for SessionProvider.
 *
 * Focuses on the contract between SessionProvider and its consumers:
 * - Default broadcast is a no-op until a session is started.
 * - openDocument restores the model from the API response.
 * - createNewDocument seeds the current state to the backend.
 *
 * Deep WebSocket lifecycle is covered by CollaborationClient.test.ts;
 * here we just verify the wiring at the session boundary.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useContext } from 'react';
import { act, render } from '@testing-library/react';

import SessionProvider from '@/session/SessionProvider';
import { SessionContext, SessionContextInterface } from '@/session/SessionContext';
import { model } from '@/models/GraphicEditorModel';

/** Captures whatever the context provides for inspection from tests. */
function ContextHarness({ ref }: { ref: { current: SessionContextInterface | null } }) {
  const ctx = useContext(SessionContext);
  ref.current = ctx;
  return null;
}

function jsonResponse<T>(body: T, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(''),
  } as Response;
}

describe('SessionProvider', () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    model.restore([]);
    originalWebSocket = globalThis.WebSocket;
    // Stub WebSocket so connect() doesn't try to reach a real server.
    class StubWS {
      readyState = 0;
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onmessage: (() => void) | null = null;
      onerror: (() => void) | null = null;
      send() {}
      close() {
        this.readyState = 3;
      }
    }
    (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket =
      StubWS as unknown as typeof WebSocket;
  });

  afterEach(() => {
    (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket =
      originalWebSocket;
    vi.restoreAllMocks();
  });

  it('starts idle with no current document and a no-op broadcast', () => {
    const ref = { current: null as SessionContextInterface | null };
    render(
      <SessionProvider>
        <ContextHarness ref={ref} />
      </SessionProvider>,
    );

    expect(ref.current?.current).toBeNull();
    expect(ref.current?.status).toBe('idle');
    // Should not throw — just a no-op.
    expect(() => ref.current?.broadcast('object_remove', ['x'])).not.toThrow();
  });

  it('openDocument loads JSON content into the model', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        id: 'doc-1',
        title: 'Loaded',
        content: JSON.stringify([
          {
            id: 'X',
            type: 'rectangle',
            title: 'r',
            color: '#000',
            rotation: 0,
            position: { x: 0, y: 0 },
            scale: { width: 10, height: 10 },
          },
        ]),
        createdAt: '',
        updatedAt: '',
      }),
    );

    const ref = { current: null as SessionContextInterface | null };
    render(
      <SessionProvider>
        <ContextHarness ref={ref} />
      </SessionProvider>,
    );

    await act(async () => {
      await ref.current?.openDocument('doc-1');
    });

    expect(ref.current?.current?.id).toBe('doc-1');
    expect(ref.current?.status).toBe('open');
    expect(model.snapshot).toHaveLength(1);
    expect(model.snapshot[0].id).toBe('X');
  });

  it('closeDocument empties the model and returns to idle', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        id: 'doc-1',
        title: 'Doc',
        content: '[]',
        createdAt: '',
        updatedAt: '',
      }),
    );

    const ref = { current: null as SessionContextInterface | null };
    render(
      <SessionProvider>
        <ContextHarness ref={ref} />
      </SessionProvider>,
    );

    await act(async () => {
      await ref.current?.openDocument('doc-1');
    });

    act(() => {
      ref.current?.closeDocument();
    });

    expect(ref.current?.current).toBeNull();
    expect(ref.current?.status).toBe('idle');
    expect(model.snapshot).toEqual([]);
  });
});
