# Changelog

All notable changes to this project are documented here.

## [0.1.0.0] - 2026-09-02

First versioned release. Establishes the collaborative architecture.
**Live multi-client editing works**; persistence to an empty room and several
correctness gaps do not — see Known Broken below.

### Added
- **Spring Boot backend** (`backend/`): document CRUD over REST, H2 storage,
  per-document WebSocket rooms at `/api/collaboration/{documentId}`.
- **Yjs CRDT client model** (`YjsGraphicModel`): `Y.Doc` wrapping the layer stack
  as a `Y.Array` of `Y.Map` shapes, with nested `Y.Array` group children.
  Mirrors the previous `GraphicEditorModel` API.
- **Working real-time collaboration.** Two or more browsers on the same document
  now see each other's edits live, in both directions, including a client that
  joins after the edits were made. Verified with four browser tabs.
- **Binary collaboration transport**: `CollaborationClient` speaks
  `ArrayBuffer` frames with an envelope byte (`0` = Yjs sync, `1` = awareness,
  `2` = state request). `CollaborationHandler` extends `BinaryWebSocketHandler`
  and relays frames to the room.
- **Two-leg peer handshake.** On every connect (including reconnects) a client
  sends its full document state and asks peers for theirs. Without the second
  leg a joiner announces what it has and nobody tells it what it is missing, so
  opening a document with existing content showed a blank canvas.
- **Concurrency guards on the server**: sessions are wrapped in
  `ConcurrentWebSocketSessionDecorator` (Spring sessions are not safe for
  concurrent sends) and keyed by session id, because the decorator does not
  override `equals`/`hashCode` and a set keyed by identity would leak rooms
  forever. Room removal uses `compute()` so the empty-check is atomic.
  `maxBinaryMessageBufferSize` raised from Tomcat's 8192 default to 4 MB.
- **Session layer**: `SessionProvider` / `SessionContext` own which document is
  open and the WebSocket lifecycle. `DocumentBar` view for open/create/delete.
- **Design doc and review artifacts**: `docs/designs/`, `PLAN.md`, `TODOS.md`,
  `ARCHITECTURE.md`.

### Changed
- **Persistence is now the Yjs binary**, base64-encoded into the existing TEXT
  column, replacing the JSON snapshot. Seeding two clients from a JSON snapshot
  made each build its own `Y.Map` objects, so the replicas shared no CRDT
  identity and merging duplicated every shape. Replaying an update is
  idempotent instead. Legacy JSON content is still read once; the next save
  rewrites it as binary.
- `CollaborationClient` now reports the WebSocket close code and reason instead
  of logging a bare `[Collab] Disconnected`. That one line is why a total
  outage went undiagnosed for three months.
- **Repo restructure**: the frontend moved from the repo root into `frontend/`,
  so it and `backend/` are now siblings. Root holds docs plus a thin
  `package.json` with `dev:all`, `test:all`, and `lint`. No build-config edits
  were needed — every path was already relative.
- `GraphicEditorModel` is now a re-export shim over `YjsGraphicModel`.
- README quick start rewritten: documents both halves, the one-command path, and
  the real dev URL (`localhost:5173/pswp-graphic-tool/`).

### Removed
- `_zettel/` and `.pi/` are no longer tracked (personal notes and agent-harness
  config; `.pi/` is kept on disk).

### Known Broken
- **No server-side document state.** The server is a relay and keeps no replica,
  so initial sync comes from a live peer. Open a document when nobody else is in
  the room and you get whatever was last saved — if nothing was saved, a blank
  canvas. Fixing this needs the server-side update log from the design doc.
- **The connection indicator still lies.** `isConnected` is sampled at 250ms and
  1000ms and never again, so the badge can read "Live" after a disconnect.
- **`YjsGraphicModel.reorder` / `group` / `ungroup` are not CRDT-safe.** They
  delete the live `Y.Map` and rebuild it from a plain-object round trip.
  Verified on yjs 13.6.31: two concurrent reorders produce a duplicated shape id
  on both peers, and a concurrent property edit is silently discarded. Both cases
  converge, so a snapshot-equality test passes on the corrupt document.
- **No document persistence across peers.** Each client seeds its `Y.Doc` from
  the stored JSON independently, which duplicates every shape on merge.
- **4 of 22 backend tests fail**, and have since the backend was added
  (2026-05-18). `NoSuchElementException` escapes as HTTP 500 where the tests
  expect 404, because no `@RestControllerAdvice` exists:
  `DocumentControllerTest.getDocument_Returns404_WhenNotFound`,
  `.updateDocument_Returns404_WhenNotFound`,
  `.deleteDocument_Returns404_WhenNotFound`, and
  `DocumentIntegrationTest.fullCrudLifecycle`.
- `npm run lint` reports 6 pre-existing `no-explicit-any` errors in the
  `CollaborationClient` test WebSocket mock.
- `mvn -o test` cannot resolve the surefire plugin offline even with a warm
  `~/.m2`; the backend needs network on a cold run.
- No CI. The 116 frontend tests mock the WebSocket and never deliver an
  `ArrayBuffer`, which is why the outage above went unnoticed.

See `PLAN.md` for the full review findings (6 critical, 8 high, 11 medium) and
the ordered task list.
