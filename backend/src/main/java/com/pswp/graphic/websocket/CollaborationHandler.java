package com.pswp.graphic.websocket;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket handler for real-time document collaboration.
 *
 * <p>Each document has a "room" identified by its UUID. When a client connects
 * to {@code /api/collaboration/{documentId}}, it joins that room; every binary
 * frame it sends is relayed to the other members.
 *
 * <p>Frames are raw binary, not text. The first byte is an envelope tag:
 * <ul>
 *   <li>{@code 0} — Yjs document sync (a CRDT update)</li>
 *   <li>{@code 1} — awareness / presence (not yet produced by the client)</li>
 * </ul>
 * The server does not decode the payload. It is a relay: it forwards bytes to
 * peers and lets each client's Yjs replica merge them.
 *
 * <p><b>Sessions are stored wrapped and keyed by id.</b> Spring's
 * {@code WebSocketSession} is not safe for concurrent sends, so each one is
 * wrapped in a {@link ConcurrentWebSocketSessionDecorator}. That decorator does
 * not override {@code equals}/{@code hashCode}, so a set keyed by object
 * identity would never match the raw session Spring hands to
 * {@link #afterConnectionClosed} and rooms would leak forever. Keying the map
 * by {@code session.getId()} (which the decorator delegates) avoids that.
 *
 * <p><b>Not yet implemented:</b> the server keeps no document state, so a client
 * joining a room with no live peers receives nothing. Initial sync currently
 * comes from a peer, which sends its full state on connect. See PLAN.md.
 */
@Component
public class CollaborationHandler extends BinaryWebSocketHandler {

    /** Buffered outbound bytes allowed per session before it is closed. */
    private static final int SEND_BUFFER_LIMIT = 4 * 1024 * 1024;

    /** How long a single send may block before the session is closed. */
    private static final int SEND_TIME_LIMIT_MS = 10_000;

    /** documentId -> (sessionId -> wrapped session). */
    private final Map<String, Map<String, WebSocketSession>> documentRooms = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String documentId = extractDocumentId(session);
        WebSocketSession guarded =
                new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, SEND_BUFFER_LIMIT);

        Map<String, WebSocketSession> room =
                documentRooms.computeIfAbsent(documentId, k -> new ConcurrentHashMap<>());
        room.put(session.getId(), guarded);

        System.out.println("Client connected to document " + documentId
                + " (total: " + room.size() + ")");
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
        broadcastToRoom(extractDocumentId(session), message, session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String documentId = extractDocumentId(session);

        // compute() so the emptiness check and the room removal are atomic. A
        // plain get/remove/isEmpty races a concurrent join and can strand that
        // joiner in an orphaned room that no later peer will ever reach.
        documentRooms.compute(documentId, (id, room) -> {
            if (room == null) return null;
            room.remove(session.getId());
            return room.isEmpty() ? null : room;
        });

        System.out.println("Client disconnected from document " + documentId
                + " (" + status + ")");
    }

    /** Relays a frame to every other client in the room. */
    private void broadcastToRoom(String documentId, BinaryMessage message, String senderId) {
        Map<String, WebSocketSession> room = documentRooms.get(documentId);
        if (room == null) return;

        room.forEach((sessionId, peer) -> {
            if (sessionId.equals(senderId) || !peer.isOpen()) return;
            try {
                peer.sendMessage(message);
            } catch (IOException e) {
                // The peer is unreachable. Close it so its client reconnects and
                // re-sends its full state, rather than leaving it silently
                // diverged while its UI still reports a live connection.
                System.err.println("Relay to peer " + sessionId + " failed: " + e.getMessage());
                try {
                    peer.close(CloseStatus.SERVER_ERROR);
                } catch (IOException ignored) {
                    // already gone
                }
            }
        });
    }

    /**
     * Extracts the document ID from the WebSocket URI path.
     * Path format: {@code /api/collaboration/{documentId}}
     */
    private String extractDocumentId(WebSocketSession session) {
        String path = session.getUri() != null ? session.getUri().getPath() : "";
        String[] segments = path.split("/");
        return segments.length > 0 ? segments[segments.length - 1] : "unknown";
    }
}
