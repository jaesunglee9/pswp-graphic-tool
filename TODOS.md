# TODOS

Deferred scope from the /autoplan review (2026-09-02, branch `dev`).
Blocking Phase 2 work lives in PLAN.md, not here.

## Backend

### Add @RestControllerAdvice so missing documents return 404

**What:** Map `NoSuchElementException` to 404 and `MethodArgumentNotValidException`
to 400 with field errors. RFC 9457 Problem Details.

**Why:** 4 of 22 backend tests fail on this today and have since the backend
landed. A missing document returns HTTP 500, and the frontend renders the raw
Spring error JSON into the status bar.

**Context:** No `@ControllerAdvice` exists in `backend/src/main/java`. Failing:
`DocumentControllerTest.{get,update,delete}Document_Returns404_WhenNotFound`
and `DocumentIntegrationTest.fullCrudLifecycle`. ~15 lines fixes all four.

**Effort:** S
**Priority:** P1
**Depends on:** None

### Migrate or reject documents stored in the pre-v0.2.0.0 encoding

**What:** Detect a stored Yjs update that uses the old nested-`children`
encoding and either flatten it or refuse to load it with a clear message.

**Why:** v0.2.0.0 changed the document encoding. An old document loads with its
groups empty — children silently vanish.

**Context:** Harmless today because `jdbc:h2:mem:` wipes on restart and the
legacy JSON path still flattens correctly. Becomes a real migration the moment
persistence moves to disk, which is itself a P1 elsewhere in this file. Do this
BEFORE switching H2 to file mode.

**Effort:** M
**Priority:** P1
**Depends on:** None

### Real auth + per-document ownership

**What:** Authenticate WebSocket and REST callers; scope documents to owners.

**Why:** Any client can join any document id today. Combined with the planned
compaction endpoint, an unauthenticated caller could destroy any document.

**Context:** `WebSocketConfig.java:34` and `CorsConfig.java:17` both set
`allowedOrigins("*")`. Acceptable for a localhost research project; blocking
before any public deployment with real content.

**Effort:** M
**Priority:** P1
**Depends on:** None

### Server-side Y.Doc via yrs JNI (design doc Stage 2)

**What:** Replace the update log with a real server-side CRDT replica.

**Why:** Server-computed minimal diffs, server-side GC, document versioning.

**Context:** Gated on confirming a maintained JVM `yrs` binding exists. The
maintained bindings are ywasm, ypy, yrb, yswift, ydotnet — possibly none for the
JVM. If none exists this is "write and maintain JNI bindings over yrs," a
different project. Do not start before verifying.

**Effort:** XL
**Priority:** P3
**Depends on:** Phase 2 complete

### Generic reusable Yjs room service

**What:** Extract room/log/compaction logic from `CollaborationHandler` into a
document-type-agnostic Java library.

**Why:** The Codex CEO review argued this is the genuinely valuable OSS
contribution — a documented, compatibility-tested JVM Yjs relay is something the
ecosystem lacks. Also the only way to unit-test the room logic.

**Context:** Extracting a plain `DocumentRoom` class is already in Phase 2 scope
(PLAN.md decision #25) for testability. Publishing it as a reusable library is
the deferred part.

**Effort:** L
**Priority:** P3
**Depends on:** Phase 2 complete

## Infrastructure

### Metrics and dashboards

**What:** Active rooms, sessions per room, log rows per document, replay
duration, compaction age.

**Why:** The current observability story is three `System.out.println` calls.

**Context:** Structured logging is in Phase 2 scope (decision #5); metrics
infrastructure is not.

**Effort:** M
**Priority:** P2
**Depends on:** Phase 2 complete

## Frontend

### withHandlers decorator not applied

**What:** `withHandlers.tsx:7` carries a TODO — the HOC/decorator pattern was
never wired up.

**Why:** Pre-existing dead abstraction.

**Context:** Author's own TODO, predates the Yjs work.

**Effort:** S
**Priority:** P4
**Depends on:** None

### useDrag leaves isDragging true when the pointer exits the window

**What:** The `mouseup` listener is on `document`, so releasing outside the
window never clears drag state.

**Why:** Shape follows the cursor after the user has released the button.

**Context:** `useDrag.ts:27-29`. Also relevant to the drag-rate work — the same
hook fires `updatePosition` on every raw `mousemove`.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Backend (continued)

### Server-side document state so an empty room can serve a joiner

**What:** Keep a per-room append-only Yjs update log plus a compacted snapshot,
and replay it to every joiner.

**Why:** The server is a pure relay today, so initial sync only works when a
live peer is present. Open a document alone and you get whatever was last
saved; nothing was saved, blank canvas.

**Context:** This is the Stage 1 design in
docs/designs/yjs-binary-sync-stateful-room.md. The peer handshake (envelope 2)
shipped in v0.1.0.0 covers the live-peer case and is the reason collaboration
works at all right now.

**Effort:** L
**Priority:** P1
**Depends on:** None

## Completed

### Fix CRDT-unsafe reorder / group / ungroup
The three methods deleted a shape's `Y.Map` and rebuilt it, which duplicated
ids and discarded concurrent property edits. Ordering is now a fractional-index
`order` field and grouping a `parentId` field, so a move is a single `set()`.
`snapshot` rebuilds the nested tree, so no view or type changed.
Guarded by `CrdtSafety.test.ts`, 4 of whose 5 tests failed before the fix.
**Completed:** v0.2.0.0 (2026-09-03)

### move/update/remove traversal asymmetry
`move` recursed into group children while `update` and `remove` scanned only the
top level. The flat encoding removes the distinction: all three operate on the
same flat row set.
**Completed:** v0.2.0.0 (2026-09-03)

### Relay binary WebSocket frames instead of rejecting them
`CollaborationHandler` extended `TextWebSocketHandler`, which closed the session
with 1003 on the first edit. Now extends `BinaryWebSocketHandler`, wraps
sessions in `ConcurrentWebSocketSessionDecorator`, keys the room by session id,
and removes rooms atomically via `compute()`.
**Completed:** v0.1.0.0 (2026-09-03)

### Stop seeding clients from a JSON snapshot
Each client built its own `Y.Map` objects from the JSON, so replicas shared no
CRDT identity and merging duplicated every shape. Persistence is now the
base64-encoded Yjs update, which is idempotent on replay.
**Completed:** v0.1.0.0 (2026-09-03)

### Two-leg peer handshake for initial sync
Clients send full state on every connect and ask peers for theirs (envelope 2).
Late joiners now receive existing content from a live peer.
**Completed:** v0.1.0.0 (2026-09-03)

<!-- Documentation reconciliation (README / ARCHITECTURE.md / JSDoc vs the design
     doc) was moved OUT of this file and INTO PLAN.md as a Phase 2 exit criterion
     by review decision #30. Deferring doc reconciliation through a protocol
     rewrite was backwards. -->
