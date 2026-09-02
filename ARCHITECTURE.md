# PSWP Graphic Tool — System Architecture Spec

This document details the collaborative, CRDT-based architecture of the editor.

## Table of Contents

1. [Yjs CRDT Client State mapping](#1-yjs-crdt-client-state-mapping)
2. [Binary Sync Protocol](#2-binary-sync-protocol)
3. [Java Spring Boot Relational Storage & Relay](#3-java-spring-boot-relational-storage--relay)
4. [Modular Undo & Redo Model](#4-modular-undo--redo-model)

## 1. Yjs CRDT Client State mapping

To guarantee eventual consistency, all canvas shapes are managed dynamically in a single `Y.Doc`:
- **`objects` (Y.Array)**: Holds the top-level ordered layer stack of shapes.
- **Layers (Y.Map)**: Each shape is represented as a `Y.Map` holding keys like `id`, `type`, `color`, `rotation`.
- **Nested Structures**: Complex properties (like `position` and `scale`) are stored as plain JS objects (`{ x, y }`).
- **Groups**: A shape of `type: group` contains a nested Yjs `Y.Array` named `children` to hold its nested maps.

## 2. Binary Sync Protocol

Synchronization operates directly via raw `Uint8Array` binary WebSocket frames:
- **Header Byte**: Every frame begins with a single `uint8` prefix representing the message type:
  - `0`: **Yjs Document Sync** (relays document changes peer-to-peer).
  - `1`: **Awareness Protocol** (relays client cursors and local presence states).
- **Payload Relay**: The Spring Boot WebSocket handler acts as a stateless broadcast channel, instantly forwarding binary packets to all peers in the same document room.

## 3. Java Spring Boot Relational Storage & Relay

The Spring Boot backend shifts from checking JSON schema to managing byte blocks:
- **Binary Storage**: The `documents` table's `content` column changes from `TEXT` to `BLOB` / `BYTEA`.
- **Relay Delivery**: Receives binary frames and broadcasts them peer-to-peer statelessly.
- **Auto-Sync**: On initial join, the full binary document is loaded from the database and sent to the client to initialize their `Y.Doc`.

## 4. Modular Undo & Redo Model

History tracking is handled transparently client-side via Yjs:
- **Transaction Origin Tracking**: Actions are categorized as 'local' or 'remote'.
- **`Y.UndoManager`**: Scoped purely to local transaction origins. This guarantees that performing an undo reverts only the current user's local edits and bypasses peer actions.
- **Continuous Gesture Debounce**: Drag-and-drop operations group multiple frames into a single, cohesive undo milestone.
