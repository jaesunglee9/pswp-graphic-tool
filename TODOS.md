# TODOS

Deferred scope from the /autoplan review (2026-09-02, branch `dev`).
Blocking Phase 2 work lives in PLAN.md, not here.

## Model

### Fix CRDT-unsafe reorder / group / ungroup

**What:** Replace delete-and-rebuild with stable CRDT identity: ordering as a
fractional-index `order` field, group membership as a `parentId` field.

**Why:** Verified on yjs 13.6.31 — two concurrent reorders produce a duplicated
shape id on both peers, and a concurrent property edit is silently discarded.
Both converge, so a snapshot-equality test passes on the corrupt document.

**Context:** `YjsGraphicModel.ts:210-245` (`group`), `:252-280` (`ungroup`),
`:283-295` (`reorder`). This is why PLAN.md Phase 1 is marked REOPENED. It
blocks every other Phase 2 task; tracked in PLAN.md as decision #16.

**Effort:** L
**Priority:** P0
**Depends on:** None

### move/update/remove traversal asymmetry

**What:** `move()` recurses into group children via `yWalk`; `update()` and
`remove()` scan top level only.

**Why:** Inconsistent undo and edit granularity for grouped shapes.

**Context:** Currently unreachable from the UI — `Shape/index.tsx` routes clicks
through `findSelectable`, which returns the containing group, so selection can
never hold a child id. Becomes reachable if selection semantics change.

**Effort:** S
**Priority:** P3
**Depends on:** None

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

## Completed

_None yet._

<!-- Documentation reconciliation (README / ARCHITECTURE.md / JSDoc vs the design
     doc) was moved OUT of this file and INTO PLAN.md as a Phase 2 exit criterion
     by review decision #30. Deferring doc reconciliation through a protocol
     rewrite was backwards. -->
