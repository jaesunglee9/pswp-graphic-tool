/**
 * Tests for the CollaborationClient (WebSocket wrapper).
 *
 * Uses vi.stubGlobal with a proper constructor mock.
 */
import { CollaborationClient, CollaborationMessage } from '@/collaboration/CollaborationClient';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface MockWS {
  url: string;
  readyState: number;
  onopen: (() => void) | null;
  onclose: ((e: unknown) => void) | null;
  onmessage: ((e: { data: string }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  closeCalled: boolean;
  sentMessages: string[];
  send: (data: string) => void;
  close: () => void;
}

describe('CollaborationClient', () => {
  /** All mock WS instances created, in order. */
  let mockInstances: MockWS[] = [];

  /**
   * Constructor mock for WebSocket. The CollaborationClient calls `new
   * WebSocket(url)`, so we return a fresh MockWS each time and capture
   * it in `mockInstances` for tests to inspect.
   */
  function MockWebSocket(url: string): MockWS {
    const ws: MockWS = {
      url,
      readyState: 0, // WebSocket.CONNECTING
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
      closeCalled: false,
      sentMessages: [],
      send(data: string) {
        ws.sentMessages.push(data);
      },
      close() {
        ws.closeCalled = true;
        ws.readyState = 3; // WebSocket.CLOSED
      },
    };
    mockInstances.push(ws);
    return ws;
  }

  /** Simulates a real WS opening: readyState flips to OPEN, then onopen fires. */
  function fireOpen(ws: MockWS) {
    ws.readyState = 1; // WebSocket.OPEN
    ws.onopen?.();
  }

  /** Simulates a real WS closing: readyState flips to CLOSED, then onclose fires. */
  function fireClose(ws: MockWS, event: unknown = { code: 1006 }) {
    ws.readyState = 3; // WebSocket.CLOSED
    ws.onclose?.(event);
  }

  // Constants on the mock match the real WebSocket interface.
  type MockWSCtor = typeof MockWebSocket & {
    CONNECTING: number;
    OPEN: number;
    CLOSING: number;
    CLOSED: number;
    prototype: WebSocket;
  };
  const MockCtor = MockWebSocket as MockWSCtor;
  MockCtor.prototype = Object.create(WebSocket.prototype);
  MockCtor.CONNECTING = 0;
  MockCtor.OPEN = 1;
  MockCtor.CLOSING = 2;
  MockCtor.CLOSED = 3;

  beforeEach(() => {
    mockInstances = [];
    vi.stubGlobal('WebSocket', MockCtor as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('connects to the correct WebSocket URL', () => {
    const client = new CollaborationClient('test-doc-uuid');
    client.connect();
    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0].url).toBe('ws://localhost:8080/api/collaboration/test-doc-uuid');
    client.disconnect();
  });

  it('sets isConnected to true after connection opens', () => {
    const client = new CollaborationClient('test-doc-uuid');
    client.connect();
    expect(client.isConnected).toBe(false);
    fireOpen(mockInstances[0]);
    expect(client.isConnected).toBe(true);
    client.disconnect();
  });

  it('sends a message as JSON', () => {
    const client = new CollaborationClient('test-doc-uuid');
    client.connect();
    fireOpen(mockInstances[0]);
    client.send('object_update', { id: 'obj-1', patch: { color: 'red' } });
    expect(mockInstances[0].sentMessages).toHaveLength(1);
    const parsed = JSON.parse(mockInstances[0].sentMessages[0]);
    expect(parsed.type).toBe('object_update');
    expect(parsed.data.id).toBe('obj-1');
    expect(parsed.timestamp).toBeDefined();
    client.disconnect();
  });

  it('warns when sending while not connected', () => {
    const client = new CollaborationClient('test-doc-uuid');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    client.send('object_add', {});
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('receives messages via onMessage handler', () => {
    const client = new CollaborationClient('test-doc-uuid');
    const handler = vi.fn();
    client.onMessage(handler);
    client.connect();
    fireOpen(mockInstances[0]);

    const msg: CollaborationMessage = { type: 'full_state', data: [], timestamp: Date.now() };
    mockInstances[0].onmessage?.({ data: JSON.stringify(msg) });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'full_state' }));
    client.disconnect();
  });

  it('removes handler when unsubscribed', () => {
    const client = new CollaborationClient('test-doc-uuid');
    const handler = vi.fn();
    const unsub = client.onMessage(handler);
    unsub();

    client.connect();
    fireOpen(mockInstances[0]);
    mockInstances[0].onmessage?.({ data: JSON.stringify({ type: 'full_state', data: [] }) });

    expect(handler).not.toHaveBeenCalled();
    client.disconnect();
  });

  it('disconnect closes the connection', () => {
    const client = new CollaborationClient('test-doc-uuid');
    client.connect();
    fireOpen(mockInstances[0]);
    client.disconnect();
    expect(mockInstances[0].closeCalled).toBe(true);
    expect(client.isConnected).toBe(false);
  });

  it('tries to reconnect on close', () => {
    vi.useFakeTimers();
    const client = new CollaborationClient('test-doc-uuid');
    client.connect();
    fireOpen(mockInstances[0]);

    // Trigger close
    fireClose(mockInstances[0], { code: 1006, reason: 'Abnormal closure' });

    // Advance past reconnection delay
    vi.advanceTimersByTime(2000);

    // Should have created a new WebSocket
    expect(mockInstances).toHaveLength(2);
    client.disconnect();
    vi.useRealTimers();
  });
});