# Changelog

All notable changes to this project are documented here.

## [0.1.0.0] - 2026-09-02

First versioned release. Establishes the collaborative architecture. **Real-time
collaboration is not functional yet** — see Known Broken below.

### Added
- **Spring Boot backend** (`backend/`): document CRUD over REST, H2 storage,
  per-document WebSocket rooms at `/api/collaboration/{documentId}`.
- **Yjs CRDT client model** (`YjsGraphicModel`): `Y.Doc` wrapping the layer stack
  as a `Y.Array` of `Y.Map` shapes, with nested `Y.Array` group children.
  Mirrors the previous `GraphicEditorModel` API.
- **Binary collaboration transport**: `CollaborationClient` speaks
  `ArrayBuffer` frames with an envelope byte (`0` = Yjs sync, `1` = awareness).
- **Session layer**: `SessionProvider` / `SessionContext` own which document is
  open and the WebSocket lifecycle. `DocumentBar` view for open/create/delete.
- **Design doc and review artifacts**: `docs/designs/`, `PLAN.md`, `TODOS.md`,
  `ARCHITECTURE.md`.

### Changed
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
- **Collaboration does not work.** The client sends binary frames;
  `CollaborationHandler` extends `TextWebSocketHandler`, which rejects them with
  close code 1003 (`"Binary messages not supported"`). Verified live. The UI
  still shows "Live" because `isConnected` is sampled twice and never again.
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
