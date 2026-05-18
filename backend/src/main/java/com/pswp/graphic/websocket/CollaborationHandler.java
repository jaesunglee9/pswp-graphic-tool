package com.pswp.graphic.websocket;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * WebSocket handler for real-time document collaboration.
 *
 * <p>Each document has a "room" identified by its UUID. When a client
 * connects to {@code /api/collaboration/{documentId}}, they are added
 * to that document's room. Any message they send is broadcast to all
 * other clients in the same room.
 *
 * <p>Message format (JSON):
 * <pre>
 * {
 *   "type": "object_update",
 *   "data": { ... }  // Partial or full graphic object state
 * }
 * </pre>
 *
 * <p>Built-in message types:
 * <ul>
 *   <li>{@code object_add} — A new object was created</li>
 *   <li>{@code object_update} — An object's properties changed</li>
 *   <li>{@code object_remove} — An object was deleted</li>
 *   <li>{@code object_move} — Objects were moved by a delta</li>
 *   <li>{@code full_state} — Full canvas state sync (sent on join)</li>
 *   <li>{@code cursor_move} — Cursor position for presence indicators</li>
 * </ul>
 */
@Component
public class CollaborationHandler extends TextWebSocketHandler {

    /**
     * Map of documentId → set of active WebSocket sessions.
     */
    private final Map<String, Set<WebSocketSession>> documentRooms = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String documentId = extractDocumentId(session);
        documentRooms
                .computeIfAbsent(documentId, k -> new CopyOnWriteArraySet<>())
                .add(session);
        System.out.println("Client connected to document " + documentId
                + " (total: " + documentRooms.get(documentId).size() + ")");
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String documentId = extractDocumentId(session);
        broadcastToRoom(documentId, message, session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String documentId = extractDocumentId(session);
        Set<WebSocketSession> room = documentRooms.get(documentId);
        if (room != null) {
            room.remove(session);
            if (room.isEmpty()) {
                documentRooms.remove(documentId);
            }
        }
        System.out.println("Client disconnected from document " + documentId);
    }

    /**
     * Sends a message to all clients in a room except the sender.
     */
    private void broadcastToRoom(String documentId, TextMessage message, WebSocketSession sender) {
        Set<WebSocketSession> room = documentRooms.get(documentId);
        if (room == null) return;

        for (WebSocketSession peer : room) {
            if (peer.isOpen() && !peer.getId().equals(sender.getId())) {
                try {
                    peer.sendMessage(message);
                } catch (IOException e) {
                    System.err.println("Failed to send message to peer: " + e.getMessage());
                }
            }
        }
    }

    /**
     * Extracts the document ID from the WebSocket URI path.
     * The path format is: {@code /api/collaboration/{documentId}}
     */
    private String extractDocumentId(WebSocketSession session) {
        String path = session.getUri() != null ? session.getUri().getPath() : "";
        String[] segments = path.split("/");
        return segments.length > 0 ? segments[segments.length - 1] : "unknown";
    }
}