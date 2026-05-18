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

type MessageHandler = (message: CollaborationMessage) => void;

const WS_BASE_URL = 'ws://localhost:8080/api/collaboration';

export class CollaborationClient {
  private ws: WebSocket | null = null;
  private documentId: string;
  private handlers: Set<MessageHandler> = new Set();
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

    this.ws.onopen = () => {
      console.log(`[Collab] Connected to document ${this.documentId}`);
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message: CollaborationMessage = JSON.parse(event.data);
        this.handlers.forEach((handler) => handler(message));
      } catch (err) {
        console.error('[Collab] Failed to parse message:', err);
      }
    };

    this.ws.onclose = () => {
      console.log('[Collab] Disconnected');
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

  /** Send a message to all other clients in the room. */
  send(type: CollaborationMessageType, data: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('[Collab] Cannot send — not connected');
      return;
    }

    const message: CollaborationMessage = {
      type,
      data,
      timestamp: Date.now(),
    };

    this.ws.send(JSON.stringify(message));
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