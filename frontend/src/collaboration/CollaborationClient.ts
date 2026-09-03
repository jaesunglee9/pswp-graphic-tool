/**
 * WebSocket client for real-time collaboration.
 *
 * Connects to the Spring Boot backend's WebSocket endpoint and
 * coordinates graphic object changes between multiple users
 * editing the same document.
 *
 * ## Message Protocol
 *
 * Messages are JSON with a `type` field and a `data` payload:
 *
 * | type | data | direction | description |
 * |------|------|-----------|-------------|
 * | `object_add` | GraphicObjectInterface | send+receive | Object created |
 * | `object_update` | { id, patch } | send+receive | Object properties changed |
 * | `object_remove` | string[] | send+receive | Objects deleted |
 * | `object_move` | { ids, diff } | send+receive | Objects moved by delta |
 * | `full_state` | GraphicObjectInterface[] | receive | Full sync on join |
 * | `cursor_move` | { userId, x, y } | send+receive | Cursor position |
 *
 * ## Usage
 *
 * ```ts
 * const collab = new CollaborationClient('doc-uuid-123');
 * collab.onMessage((msg) => console.log(msg));
 * collab.send('object_update', { id: 'obj-1', patch: { color: 'red' } });
 * collab.disconnect();
 * ```
 */

export type CollaborationMessageType =
  | 'object_add'
  | 'object_update'
  | 'object_remove'
  | 'object_move'
  | 'full_state'
  | 'cursor_move';

export interface CollaborationMessage {
  type: CollaborationMessageType;
  data: unknown;
  sender?: string;
  timestamp?: number;
}

type MessageHandler = (update: Uint8Array) => void;

const WS_BASE_URL = 'ws://localhost:8080/api/collaboration';

export class CollaborationClient {
  private ws: WebSocket | null = null;
  private documentId: string;
  private handlers: Set<MessageHandler> = new Set();
  private openHandlers: Set<() => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private shouldReconnect = true;

  constructor(documentId: string) {
    this.documentId = documentId;
  }

  /** Connect to the collaboration room for this document. */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const url = `${WS_BASE_URL}/${this.documentId}`;
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      console.log(`[Collab] Connected to document ${this.documentId}`);
      this.reconnectAttempts = 0;
      // Fires on every connect, including reconnects. Subscribers use this to
      // send their full document state so peers converge without a server-side
      // replica. Wiring this at the call site instead would only ever run once.
      this.openHandlers.forEach(h => h());
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        if (event.data instanceof ArrayBuffer) {
          const update = new Uint8Array(event.data);
          this.handlers.forEach((handler) => handler(update));
        }
      } catch (err) {
        console.error('[Collab] Failed to parse message:', err);
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      console.log(
        `[Collab] Disconnected (code=${event.code}` +
          (event.reason ? ` reason="${event.reason}"` : '') + ')'
      );
      if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`[Collab] Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[Collab] WebSocket error:', err);
      this.ws?.close();
    };
  }

  /** Disconnect from the collaboration room. */
  disconnect(): void {
    this.shouldReconnect = false;
    this.ws?.close();
    this.ws = null;
  }

  /** Send a raw binary update to all other clients in the room. */
  send(update: Uint8Array): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('[Collab] Cannot send — not connected');
      return;
    }

    this.ws.send(update);
  }

  /** Register a handler that fires on every successful connect. */
  onOpen(handler: () => void): () => void {
    this.openHandlers.add(handler);
    return () => this.openHandlers.delete(handler);
  }

  /** Register a handler for incoming messages. */
  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** Check if currently connected. */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}