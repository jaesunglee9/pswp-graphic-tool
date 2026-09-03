<!-- /autoplan restore point: /home/user0/.gstack/projects/jaesunglee9-pswp-graphic-tool/dev-autoplan-restore-20260902-221223.md -->
# PSWP Graphic Tool — Refactoring Plan

## Architecture Decision (REVISED by /autoplan 2026-09-02 — APPROVED)
- **CRDT Engine:** `yjs` (client-side). Shape identity must be stable: ordering via a
  fractional-index `order` field, group membership via `parentId`. NEVER delete-and-rebuild.
- **Backend Role:** **Stateful room**, not a dumb relay. It owns an update log and syncs
  every joiner. A stateless relay cannot serve a late joiner to an empty room.
- **Sync Protocol:** envelope byte (`0` = sync, `1` = awareness) + `y-protocols/sync`
  payload inside it. Two-leg handshake on every `onopen`: SyncStep1 + full-state Update.
  Final replay frame is tagged **SyncStep2** (`readUpdate === readSyncStep2`, so this needs
  no JVM CRDT and restores bidirectional y-websocket compatibility).
- **Persistence:** in-memory per-room log + async flush. `jdbc:h2:file:` with Flyway
  (`ddl-auto: update` will NOT alter an existing column type).
- **Full rationale:** docs/designs/yjs-binary-sync-stateful-room.md

---

## Phase 1 — Yjs Core Model (REOPENED ⛔ — was marked COMPLETE in error)

> /autoplan verified 2026-09-02 that `reorder`, `group` and `ungroup` are NOT
> CRDT-safe. They delete the live `Y.Map` and rebuild a fresh one from a plain-object
> round trip, so under concurrency:
> ```
> concurrent reorder of s1 -> BOTH peers: ["s2","s3","s1","s1"]   (duplicate id)
> recolor(BLUE) || reorder -> s1.color === "red"                  (edit discarded)
> convergent? true
> ```
> Both peers agree on the corrupt document, so Phase 6's planned convergence test
> passes. Fix ordering and grouping before any further Phase 2 work.

Goal: Wrap Y.Doc inside YjsGraphicModel with the same public API as GraphicEditorModel.

- [x] Create `src/models/YjsGraphicModel.ts` with:
  - [x] `Y.Array` for top-level layer order
  - [x] `Y.Map` per shape with nested `Y.Array` for group children
  - [x] Conversion helpers `yMapToObject` / `objectToYMap`
- [x] Implement mutation methods:
  - [x] `add(type)` — factory-created shape at index 0
  - [x] `insertObject(plain)` — idempotent remote insert
  - [x] `remove(ids)` — backward iteration delete
  - [x] `update(ids, patch)` — `applyPatch` helper for nested props
  - [x] `move(ids, diff)` — recursive `yWalk` into groups
  - [x] `group(ids)` — creates Y.Map group with Y.Array children
  - [x] `ungroup(ids)` — extracts children, replaces group
  - [x] `reorder(id, targetIdx)` — delete + insert with plain round-trip
  - [x] `restore(objects)` — mass replace
  - [x] `findSelectable(id)` — snapshot tree search
- [x] Collaboration hooks:
  - [x] `subscribe(listener)` — fires on any doc change
  - [x] `onLocalUpdate(callback)` — fires only on local changes, filters remote
  - [x] `applyRemoteUpdate(update, origin=this)` — apply peer bytes
  - [x] `encodeStateAsUpdate()` — full state binary
- [x] Export singleton: `export const model = new YjsGraphicModel()`
- [x] Delegate `GraphicEditorModel.ts` → re-export from YjsGraphicModel
- [ ] ~~108 tests passing on Yjs engine~~ — FALSE. Actual model tests: **28**
      (YjsGraphicModel.test.ts 14 + GraphicEditorModel.test.ts 14). 116 is the whole suite.
- [ ] Redesign: `order` fractional index; `parentId` grouping; invariant checker

---

## Phase 2 — Binary Collaboration Sync (IN PROGRESS 🚧)

Goal: Replace JSON text messaging with raw binary Yjs updates over WebSocket.

### Client-side (CollaborationClient.ts)
- [x] Change `MessageHandler` type to accept `Uint8Array`
- [x] Set `ws.binaryType = 'arraybuffer'` in `connect()`
- [x] Parse incoming binary as `new Uint8Array(event.data)`
- [x] Change `send()` to accept and transmit raw `Uint8Array`
- [x] 8 CollaborationClient tests passing

### Client-side (SessionProvider.tsx)
- [x] Add `modelUnsubRef` for cleanup
- [x] Update `teardownCollab` to unsubscribe from model
- [x] Parse inbound binary (msgType 0 → `model.applyRemoteUpdate`)
- [x] Package outbound local updates (`packet[0] = 0`, `packet.set(update, 1)`)
- [x] Turn `broadcast()` into no-op — superseded: DELETE the function, don't stub it
- [ ] ~~Remove unused imports~~ — NOT DONE. `npx eslint .` reports 10 errors including
      `applyRemoteMessage` unused (SessionProvider.tsx:15) and unused `type`/`data`
      (SessionProvider.tsx:199).

### Backend — REGENERATED from the /autoplan decision log
> The four original checkboxes describe the rejected design. Ordered task list:
- [ ] **DX slice first** (decision #27): `./mvnw`, `npm run dev:all`, `.env.example` +
      `VITE_WS_URL`/`VITE_API_URL`, wss, LICENSE, CI. Converts TTHW from ∞ to ~5 min.
- [ ] **Fix C1** (decision #16): fractional-index ordering + `parentId` grouping,
      with the invariant checker (#17) as the acceptance test.
- [ ] Kill the `Y.Doc` singleton and the JSON seed path **BEFORE** enabling binary (#23)
- [ ] `BinaryWebSocketHandler`; membership keyed by `session.getId()` (#21 — the
      decorator has no `equals`/`hashCode`, so `room.remove(session)` silently no-ops)
- [ ] `ConcurrentWebSocketSessionDecorator`; raise `maxBinaryMessageBufferSize` (8192 default)
- [ ] Atomic room removal via `documentRooms.compute` (H5); `UNIQUE(document_id, seq)`
- [ ] Client: `y-protocols/sync` inside the envelope; two-leg handshake in `ws.onopen`;
      export `REMOTE_ORIGIN` (#24) so remote frames are never locally undoable
- [ ] `Y.UndoManager(trackedOrigins: Set([null]))` + `stopCapturing()` at drag boundaries;
      delete `Command.ts` / `CommandManager.ts`
- [ ] Extract a plain `DocumentRoom` class (#25) — required for testability
- [ ] In-memory log + async flush (#22); replay unconditionally, terminal SyncStep2 frame
- [ ] `@RestControllerAdvice`, structured logging, close-code taxonomy 4001/4002/4003
- [ ] `docs/protocol.md` + Node reference client (#28) — Phase 2 exit criterion
- [ ] Reconcile README / ARCHITECTURE.md / JSDoc (#30) — Phase 2 exit criterion
- [ ] Compaction: **dropped from Phase 2** (taste decision, approved)

---

## Phase 3 — Y.UndoManager (NOT STARTED)
- [ ] Initialize `Y.UndoManager` scoped to local origin
- [ ] Rewire controller `undo()`/`redo()` to use Y.UndoManager
- [ ] Remove `Command.ts`, `CommandManager.ts`, `CommandWithDebounce`
- [ ] Remove snapshot-based undo tests

---

## Phase 4 — Remove full_state Broadcasts (NOT STARTED)
- [ ] Remove `broadcastFullState()` calls from `ContextProvider.tsx`
- [ ] Remove `full_state` message type from protocol
- [ ] Clean up old `CollaborationMessageType` union

---

## Phase 5 — Cursor Presence via Yjs Awareness (NOT STARTED)
- [ ] Import `y-protocols/awareness`
- [ ] Wire awareness into binary protocol (msgType 1)
- [ ] Render peer cursors on canvas

---

## Phase 6 — Concurrency Fuzz Tests (NOT STARTED)
- [ ] Simulate two clients making concurrent random edits
- [ ] Verify document convergence after all edits applied
- [ ] Verify no data loss on concurrent group/ungroup/reorder

---

## Baby-Steps Protocol (ACTIVE ⚡)

Rules enforced by global extension `~/.pi/agent/extensions/baby-steps-guardrail.ts`:

- [x] At most 1 modifying tool call per turn (edit/write/bash)
- [x] At most 1 `edits[]` entry per `edit` call (no multi-block)
- [x] Edit/write blocks limited to 35 lines max
- [x] Terminal confirmation prompt before every modification
- [x] Semantic separation of concerns (one domain per turn)
- [x] Conversational Alignment Protocol (propose → discuss → execute)

---

<!-- AUTONOMOUS DECISION LOG -->
**STATUS: APPROVED by user 2026-09-02.** Approach A retained (User Challenge declined).
Taste calls resolved as recommended: no awareness in Phase 2; compaction dropped from Phase 2.

## Decision Audit Trail

Generated by /autoplan. Mode: SELECTIVE EXPANSION. Principles: P1 completeness,
P2 boil lakes, P3 pragmatic, P4 DRY, P5 explicit over clever, P6 bias to action.

| # | Phase | Decision | Class | Principle | Rationale | Rejected |
|---|-------|----------|-------|-----------|-----------|----------|
| 1 | CEO 0C-bis | Carry forward Approach A (chosen by user at office-hours gate D2) | Mechanical | P6 | User decision, already gated | Re-asking |
| 2 | CEO 0D | Hold full scope despite ~18 files touched | Mechanical | P1 | 6 files are a mechanical String->byte[] ripple, 3 are deletions, only 2 new classes | Cutting to minimum |
| 3 | CEO 0D | E2 persistent H2 (jdbc:h2:file:) ADD TO SCOPE | Mechanical | P2 | 1 line, in blast radius, makes the persistence criterion real instead of theatre | Deferring |
| 4 | CEO 0D | E3 configurable WS URL (VITE_WS_URL + wss) ADD TO SCOPE | Mechanical | P2 | 2 files; without it GitHub Pages blocks the socket as mixed content and the feature cannot be demoed at all | Deferring |
| 5 | CEO 0D | E5 structured logging replacing System.out.println ADD TO SCOPE | Mechanical | P2 | 1 file, closes the Section 8 observability gap | Deferring |
| 6 | CEO 0D | E6 document-id validation at handshake ADD TO SCOPE | Mechanical | P2 | 1 file, closes the Section 3 unbounded-room-creation threat | Deferring |
| 7 | CEO 0D | E7 N-client + invariant convergence tests ADD TO SCOPE | Mechanical | P1 | Codex #9: snapshot equality can pass on an invalid document; invariant checks are the actual test | 2-client equality only |
| 8 | CEO 0D | E9 CI workflow (npm test + mvn test) ADD TO SCOPE | Mechanical | P2 | ~20 lines; repo has no CI and 3.5 months dormancy; cheapest abandonment insurance | Deferring |
| 9 | CEO 0D | E10 client-side update batching (rAF/50ms flush) ADD TO SCOPE | Mechanical | P1 | Verified: useDrag fires per mousemove unthrottled -> ~60 transacts/sec -> 60 INSERTs/sec under the room lock | Leaving unthrottled |
| 10 | CEO 0D | E1 awareness/cursor presence pulled into Phase 2 | TASTE | P3 | 4 files, adds a whole feature; defensible either way | see final gate |
| 11 | CEO 0D | E8 generic reusable Yjs room service DEFER to TODOS.md | Mechanical | P3 | New infra, outside blast radius | Adding now |
| 12 | CEO 0.5 | Correct design doc: emit SyncStep2 tag on final replay frame | Mechanical | P5 | readUpdate === readSyncStep2 (sync.js:109); one byte restores bidirectional compat | Keeping the false claim |
| 13 | CEO 0.5 | Add row-count compaction trigger (reverses my own YAGNI call) | Mechanical | P1 | Drag rate makes the log grow ~60 rows/sec; compaction-on-join alone does not bound it | No threshold |
| 14 | CEO 0.5 | Approach A vs reference-first vertical slice | USER CHALLENGE | - | Both models independently say the chosen direction should change | see final gate |

## CEO Review — Required Outputs

### NOT in scope (deferred)
See TODOS.md. Deferred: generic Yjs room service, metrics/dashboards, real auth,
Stage 2 yrs JNI, documentation reconciliation, and four pre-existing bugs.

### What already exists (do not rebuild)
- `CollaborationClient.ts` — binary transport is already correct; needs onopen
  exposure + backoff fix only.
- `SessionProvider.tsx:107` — the envelope byte already matches y-websocket's
  application layer. Keep it; PLAN.md implies replacing it.
- `CollaborationHandler.documentRooms` — room membership map. Reuse; only the
  base class changes.
- `DocumentController`/`Service`/`Repository` — reuse, type change only.
- `YjsGraphicModel.ts` — 356 lines, 108 tests, complete. Reuse entirely.
- `y-protocols@1.0.7` — installed, ZERO references in src/. The handshake this
  plan needs is an unused dependency already on disk.

### Dream state delta
Gets from "looks connected, silently corrupts" to "correct collaborative editing
within one server lifetime." Does NOT reach durable or deployed. Both named, not hidden.

### Error & Rescue Registry — 9 gaps, 0 rescued
| Exception | Rescued? | Required action | User sees |
|---|---|---|---|
| binary rejected (close 1003) | N GAP | surface as connection error | today: "Connected" (lies) |
| retries exhausted (5) | N GAP | cap backoff, retry forever + banner | frozen canvas, no message |
| send while CLOSED | N GAP | queue and flush on reopen | edit vanishes silently |
| malformed remote update | N GAP | try/catch per handler | cascade: later handlers skipped |
| 1009 buffer overflow | N GAP | raise limit + batch | disconnect, no reason |
| IllegalStateException (concurrent send) | N GAP | ConcurrentWebSocketSessionDecorator | that peer desyncs |
| seq collision after room drain | N GAP | seed seq from MAX(seq) | 500, room unusable |
| bad client compaction | N GAP | verify state vector covers watermark | silent history loss |
| truncated/gapped log | N GAP | refuse to serve; report pendingStructs | EMPTY canvas (worst) |

### Failure Modes Registry
| Mode | Detect? | Critical gap? |
|---|---|---|
| Binary frames rejected by server | No — UI shows Connected | **YES** (live today) |
| Duplicate shapes from JSON seeding | No — looks like user error | **YES** |
| Undo rewrites peers' canvases | No | **YES** |
| Blank canvas from incomplete log | No — looks like empty doc | **YES** |
| Log growth at drag rate (~60 rows/s) | No | **YES** |
| Convergent but invariant-violating doc | No — snapshot equality passes | **YES** |
| Mixed content blocks WS on Pages | Browser console only | YES |
| ddl-auto:update skips TEXT->BLOB | No | YES |

### Scope Expansion Decisions (SELECTIVE EXPANSION)
ACCEPTED: E2 persistent H2, E3 configurable WS URL + wss, E5 structured logging,
E6 document-id validation, E7 invariant + N-client convergence tests, E9 CI
workflow, E10 client-side update batching.
TASTE (final gate): E1 awareness/cursor presence pulled into Phase 2.
DEFERRED: E8 generic room service -> TODOS.md.

## Eng Review — Findings

Dual voices: 6/6 consensus dimensions CONFIRMED, 0 disagreements.
Test plan artifact: ~/.gstack/projects/jaesunglee9-pswp-graphic-tool/user0-dev-test-plan-20260902-223915.md

### CRITICAL — Phase 1 is not complete

**C1. reorder / group / ungroup are not CRDT-safe.** Found independently by both
voices; reproduced empirically 2026-09-02 against yjs@13.6.31:

```
concurrent reorder of s1  -> A: ["s2","s3","s1","s1"]  B: ["s2","s3","s1","s1"]
recolor(BLUE) || reorder  -> s1.color === "red"   (the BLUE edit is discarded)
convergent? true
```

All three methods delete the live Y.Map and rebuild a fresh one from a plain-object
round trip (YjsGraphicModel.ts:210-245, :252-280, :283-295). A concurrent property
edit stays attached to the tombstone. Two concurrent reorders each insert their own
clone -> two objects with the same application id -> React duplicate keys ->
remove(id) deletes both.

PLAN.md marks Phase 1 "COMPLETE" on "108 tests passing on Yjs engine". The actual
model test count is 28 (YjsGraphicModel.test.ts 14 + GraphicEditorModel.test.ts 14).
And Phase 6's planned test ("verify document convergence") returns convergent=true
on both corruptions above -- the test scheduled to catch this cannot.

FIX: stable CRDT identity. Ordering becomes an `order` fractional-index field set
via a single LWW `set`; group membership becomes a `parentId` field. Neither ever
clones a shape. This is a Phase 1 redesign the plan budgets zero time for.

**C2. Compaction is structurally impossible as specified.** seq is server-side and
never sent to any client, so the client cannot supply a watermark; the server would
truncate rows its snapshot does not contain. There is no "finished syncing" signal
to trigger the POST (the design removed SyncStep2). No watermark column is in the
schema. FIX: server sends a terminal SyncStep2 frame carrying replayedThroughSeq;
client echoes it; add documents.compacted_seq.

**C3. Two concurrent compactions destroy the log.** DocumentService is a
read-modify-write with no @Version. FIX: optimistic locking + guarded single-statement
UPDATE ... WHERE compacted_seq < ?, truncate in the same transaction.

**C4. Unauthenticated remote document-wipe.** allowedOrigins("*") + no auth +
GET /api/documents enumerates every id + a REST endpoint that truncates history on a
client's say-so = any website can destroy any document. The registry's prescribed
mitigation ("verify state vector covers watermark") is impossible in Stage 1 by
construction, since Stage 1's premise is no JVM CRDT. FIX: accept only a
server-issued token bound to a live session in that room; explicit origin list.

**C5. ConcurrentWebSocketSessionDecorator breaks room removal.** The decorator does
not override equals/hashCode, so room.remove(rawSession) is a silent no-op while the
set holds the decorator. Rooms never drain, sessions leak, seq reseed never runs.
FIX: key membership by session.getId().

**C6. disconnect() leaks a reconnect timer and never clears handlers.** A timer
scheduled just before teardown reopens a socket to the closed document, whose
onmessage still applies document A's updates into document B. Live today.

### HIGH
- H1 room lock must span the DB append to close the join race, which then serializes
  all edits behind H2 inserts and holds the lock across blocking sends. FIX: in-memory
  list + async flush; BUFFERING/ACTIVE session states so replay happens outside the lock.
- H2 join replays N frames -> N React renders. Measured: 2000 rows -> 2000 update
  events; snapshot walk 0.354ms at 200 shapes = 0.7s of snapshot alone. 10s drag
  produces 600 log rows / 23.5KB where the compacted snapshot is 249 bytes.
- H3 useUpdateView is unmemoized, so useSubscribe unsubscribes/resubscribes every
  render, with a lost-notification window that only becomes reachable once updates
  arrive asynchronously. This is the 2am bug.
- H4 steps 1-2 ship active data corruption before step 3 fixes it; once step 9 lands
  the contamination is persisted permanently.
- H5 documentRooms empty-check-then-remove is not atomic -> two rooms per document ->
  duplicate seq. The per-room lock provides no exclusion when there are two rooms.
- H6 log-vs-broadcast ordering unspecified; a failed append silently poisons every
  future joiner, and there is no ErrorBoundary anywhere.
- H7 OQ4 is not open: passing null as transactionOrigin makes every remote update
  locally undoable AND echoed back. Decide now, export REMOTE_ORIGIN.
- H8 leg 2 is an O(N^2 * |doc|) thundering herd on restart; capped-but-unjittered
  backoff synchronizes clients rather than desynchronizing them.

### MEDIUM (selected)
- M1 design doc on disk contradicts decisions #3, #12, #13 in this log -- not yet
  reconciled. ddl-auto:update will not alter TEXT -> BLOB on an existing file DB.
- M4 title/text are scalar sets, not Y.Text: concurrent editing is last-keystroke-wins
  with caret jumps. No success criterion covers text.
- M5 E10 batching must use Y.mergeUpdates (concatenation is silently lossy) plus a
  setTimeout fallback for backgrounded tabs. Batching reduces frames, not doc growth --
  the real fix is to commit one op on mouseup.
- M11 extracting a plain DocumentRoom class is the highest-ROI structural change and
  it is on the deferred list. The reason is testability, not reuse: C5/H1/H5 cannot
  be unit-tested while that logic lives inside a BinaryWebSocketHandler.

### Additional audit trail
| # | Phase | Decision | Class | Principle | Rationale |
|---|-------|----------|-------|-----------|-----------|
| 15 | Eng 0 | Proceed at full scope despite 18-file complexity trigger | Mechanical | P2 | autoplan never reduces scope |
| 16 | Eng C1 | Phase 1 reopened; fractional-index ordering + parentId grouping | Mechanical | P1 | Verified corruption; foundation is unsound |
| 17 | Eng C1 | Invariant checker replaces snapshot equality as the convergence test | Mechanical | P1 | Equality passes on a duplicated shape |
| 18 | Eng C2 | Server-issued replayedThroughSeq token + documents.compacted_seq | Mechanical | P5 | Client cannot know a server-side seq |
| 19 | Eng C3 | @Version optimistic locking on Document | Mechanical | P1 | Two compactions currently destroy the log |
| 20 | Eng C4 | Compaction accepts only a session-bound server token; explicit origins | Mechanical | P1 | Otherwise any website wipes any document |
| 21 | Eng C5 | Key room membership by session.getId() | Mechanical | P5 | Decorator has no equals/hashCode |
| 22 | Eng H1 | In-memory log + async flush instead of synchronous document_updates | Mechanical | P3 | H2 is in-memory; the table buys nothing and holds the lock |
| 23 | Eng H4 | Reorder: kill singleton + JSON seed BEFORE enabling the binary handler | Mechanical | P1 | Otherwise corruption ships and is later persisted |
| 24 | Eng H7 | Export REMOTE_ORIGIN now; OQ4 closed | Mechanical | P5 | Obvious default (null) arms the exact bug Phase 3 prevents |
| 25 | Eng M11 | Extract DocumentRoom class INTO scope (reverses defer #11) | Mechanical | P2 | Testability, not reuse; 1 new class, in blast radius |
| 26 | Eng | Drop compaction from Phase 2 entirely | TASTE | P3 | An honest unbounded in-memory log beats a scheme that silently deletes uncovered updates |

## DX Review — Findings

Dual voices: 6/6 CONFIRMED, 0 disagreements. Codex 5/50. Claude subagent 13/50.
DX overall 2.1/10. TTHW: infinite (collaboration unreachable) -> target 5 min.

Live probe by the DX reviewer against a booted backend:
  CLOSE code=1003 reason="Binary messages not supported" wasClean=true
  GET /api/documents/<valid-but-missing-uuid> -> 500, not 404
  a room was created for the id "not-a-uuid-at-all"

### DX Implementation Checklist (Phase 2 exit criteria)
- [ ] Commit a Maven wrapper (./mvnw); README currently demands Maven 3.9+ with no wrapper
- [ ] `npm run dev:all` (concurrently) so one command starts both halves
- [ ] `.env.example` + VITE_WS_URL / VITE_API_URL wired through CollaborationClient
      and api/client.ts. There are currently ZERO `import.meta.env` references in src/.
- [ ] wss:// support, or GitHub Pages can never reach the backend (mixed content)
- [ ] LICENSE file -- its absence legally blocks the "reuse the relay" goal
- [ ] Log close.code and close.reason instead of '[Collab] Disconnected'
- [ ] Drive the connection indicator from onclose, not two setTimeout polls
- [ ] @RestControllerAdvice: 404 for missing document, 400 + field errors for @Valid,
      RFC 9457 Problem Details
- [ ] Friendly message for the most common failure (backend not running) instead of
      "Failed to fetch"; never render raw server JSON into the status bar
- [ ] docs/protocol.md: byte grammar, message table, close codes (4001 unknown-document,
      4002 malformed-frame, 4003 version-mismatch), compaction endpoint schema,
      protocol version in the handshake, and a ~30-line Node reference client that
      doubles as the backend integration test
- [ ] Reconcile README / ARCHITECTURE.md / CollaborationClient JSDoc against the design
      doc -- five documents currently describe the protocol and no two agree
- [ ] Add a "message text" column to the Error & Rescue Registry; acceptance bar is
      problem + cause + fix + link
- [ ] ErrorBoundary in main.tsx
- [ ] Regenerate PLAN.md's Phase 2 checkboxes from this decision log -- anyone working
      the current 4 backend checkboxes builds the plan that was already rejected

### Additional audit trail
| # | Phase | Decision | Class | Principle | Rationale |
|---|-------|----------|-------|-----------|-----------|
| 27 | DX | Add a "step 0" DX slice BEFORE the protocol work | Mechanical | P2 | ~half a day; converts TTHW from infinite to ~5 min and is a prerequisite for anyone else reviewing the rest |
| 28 | DX | docs/protocol.md is a Phase 2 deliverable, not a TODOS deferral | Mechanical | P1 | Deferring doc reconciliation THROUGH a protocol rewrite is backwards; it is also the project's only real differentiator |
| 29 | DX | Close-code taxonomy (4001/4002/4003) + protocol version in handshake | Mechanical | P1 | For a socket API, close codes ARE the error API |
| 30 | DX | Move "documentation reconciliation" off TODOS.md into Phase 2 exit criteria | Mechanical | P1 | Reverses the earlier defer; five contradictory protocol docs is the top DX finding |
| 31 | DX | Adopt Flyway rather than trusting ddl-auto across TEXT->BLOB | Mechanical | P5 | Hibernate never alters an existing column type |

## Cross-Phase Themes

Concerns that surfaced independently in more than one phase's dual voices.
These are the highest-confidence signals this review produced.

**Theme 1: "Convergence is not correctness."** Flagged by CEO/Codex (#9), Eng/Codex
(#1), and Eng/Claude (C1) independently, across two phases. Snapshot equality after
random concurrent operations can pass on a document that is invalid -- duplicated
ids, orphaned children, dropped edits. Verified empirically. This invalidates both
the plan's Phase 6 test design AND its claim that Phase 1 is complete.

**Theme 2: distribution is not optional for an OSS project.** CEO/Claude (F1),
CEO/Codex (#10), DX/Claude (X1), DX/Codex (#1). The flagship feature cannot be
experienced by anyone who is not the author: GitHub Pages serves HTTPS, the WS URL
is a module constant pointing at ws://localhost:8080, and mixed-content blocks it.
Four voices in three phases. The design doc calls this "out of scope for Phase 2."

**Theme 3: the documentation set actively misleads.** CEO/Claude (F6), Eng/Claude
(M1), DX/Claude (D1), DX/Codex (#4). Five documents describe the wire protocol and
no two agree; README documents JSON messages the code abandoned; PLAN.md's own task
checkboxes contradict its own decision log.

**Theme 4: the plan trusts stale self-reported status.** "Phase 1 COMPLETE",
"108 tests passing", and three already-checked Phase 2 boxes that lint proves are
not done. Every phase independently caught the plan believing something about
itself that is not true.

## Completion Summary

| Phase | Voices | Consensus | Critical findings |
|---|---|---|---|
| CEO | Codex + Claude subagent | 6/6 CONFIRMED, 0 disagree | 6 |
| Design | skipped -- no UI scope | n/a | n/a |
| Eng | Codex + Claude subagent | 6/6 CONFIRMED, 0 disagree | 6 critical, 8 high, 11 medium |
| DX | Codex + Claude subagent | 6/6 CONFIRMED, 0 disagree | DX 2.1/10, TTHW infinite |

18/18 dimensions confirmed across three phases with zero model disagreements.

Status: **issues_open**. The plan cannot be implemented as written. Phase 1 must be
reopened (C1). 31 decisions auto-decided and logged above; 2 taste decisions and
1 User Challenge escalated to the approval gate.

## Implementation Tasks (aggregated across phases)

_No per-phase task lists found in ~/.gstack/projects/jaesunglee9-pswp-graphic-tool
for branch dev. Each review skill writes its own tasks-<phase>-*.jsonl; /autoplan ran
the review methodologies inline rather than invoking those skills, so no JSONL was
emitted. The actionable task set is the Decision Audit Trail (31 rows) plus the DX
Implementation Checklist above._
