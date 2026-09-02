# PSWP Graphic-Tool

> A **collaborative vector graphics editor** — draw, group, and edit shapes in real time.
>
> **Backend:** Java Spring Boot 3.4 (REST API + WebSocket)
> **Frontend:** React 19 + TypeScript + Vite

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
  - [Backend](#backend)
  - [Frontend](#frontend)
- [API Reference](#api-reference)
  - [REST Endpoints](#rest-endpoints)
  - [WebSocket Protocol](#websocket-protocol)
- [Frontend Architecture](#frontend-architecture)
  - [Patterns](#patterns)
  - [Data Flow](#data-flow)
- [Development Notes](#development-notes)
- [Future Work](#future-work)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                  │
│                                                         │
│  ┌──────────────┐    ┌──────────────────────────────┐   │
│  │   Session    │◀──▶│  HTTP Client + WebSocket     │   │
│  │  Provider    │    │  (api/, collaboration/)      │   │
│  └──────┬───────┘    └──────────────┬───────────────┘   │
│         │                           │                   │
│  ┌──────▼───────────────────────────▼───────────────┐   │
│  │           Controller (ContextProvider)           │   │
│  │       Commands · Selection · Broadcast hook      │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                               │
│             ┌───────────▼────────────┐                  │
│             │  GraphicEditorModel    │                  │
│             │  (Observable, single   │                  │
│             │   source of truth)     │                  │
│             └───────────┬────────────┘                  │
│                         │                               │
│             ┌───────────▼────────────┐                  │
│             │   Views (Canvas,       │                  │
│             │   Shapes, Toolbar,     │                  │
│             │   PropertiesPanel)     │                  │
│             └────────────────────────┘                  │
└──────────────┬──────────────────────────────────────────┘
               │
        HTTP REST  /  WebSocket
               │
┌──────────────▼──────────────────────────────────────────┐
│                Backend (Spring Boot 3.4)                │
│  ┌────────────┐   ┌────────────┐   ┌────────────────┐   │
│  │ Controller │──▶│  Service   │──▶│   Repository   │   │
│  └────────────┘   └────────────┘   └────────┬───────┘   │
│                                             │           │
│  ┌─────────────────┐               ┌────────▼───────┐   │
│  │ Collaboration   │               │   H2 (JPA)     │   │
│  │   (WebSocket)   │               │                │   │
│  └─────────────────┘               └────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Observer Pattern (Model)** | Model state changes auto-notify subscribers. No polling. |
| **Command Pattern (Undo/Redo)** | Each action snapshots model state. Undo restores the snapshot. |
| **React Context (ViewModel)** | Bridge between the non-React model and React's declarative rendering. |
| **Session layer above ViewModel** | Holds the currently open document and the collaboration channel, decoupled from local-only editing. |
| **Content as JSON text in DB** | The backend stores shape data as-is. The frontend owns shape interpretation. |
| **WebSocket rooms per document** | Each document gets a room; broadcasts exclude the sender. |
| **UUID primary keys** | No sequential IDs. Clients can correlate objects locally. |

---

## Project Structure

```
pswp-graphic-tool/
│
├── backend/                          # Java Spring Boot application
│   ├── pom.xml                       # Maven build file
│   └── src/main/
│       ├── java/com/pswp/graphic/
│       │   ├── GraphicApplication.java           # Entry point
│       │   ├── config/
│       │   │   ├── CorsConfig.java               # CORS for dev
│       │   │   └── WebSocketConfig.java          # WebSocket routing
│       │   ├── controller/
│       │   │   └── DocumentController.java       # REST endpoints
│       │   ├── model/
│       │   │   ├── Document.java                 # JPA entity
│       │   │   └── dto/
│       │   │       ├── DocumentRequest.java      # Create/update DTO
│       │   │       └── DocumentSummary.java      # List DTO
│       │   ├── repository/
│       │   │   └── DocumentRepository.java       # Spring Data JPA
│       │   ├── service/
│       │   │   └── DocumentService.java          # Business logic
│       │   └── websocket/
│       │       └── CollaborationHandler.java     # Real-time rooms
│       └── resources/
│           └── application.yml                   # Spring config
│
├── frontend/                         # TypeScript React frontend (Vite)
│   ├── package.json                  # Frontend deps and scripts
│   ├── vite.config.ts                # Vite + Vitest config
│   ├── index.html
│   └── src/
│   ├── api/                          # HTTP client layer
│   │   ├── client.ts                 # Generic fetch wrapper
│   │   └── documentApi.ts            # Typed document CRUD
│   ├── collaboration/
│   │   └── CollaborationClient.ts    # WebSocket client (auto-reconnect)
│   ├── session/                      # Open-document + collab session
│   │   ├── SessionContext.ts         # React context types
│   │   ├── SessionProvider.tsx       # Lifecycle owner
│   │   └── applyRemoteMessage.ts     # Inbound message → model
│   ├── commands/
│   │   ├── Command.ts                # Base + concrete commands
│   │   └── CommandManager.ts         # Undo/redo stacks
│   ├── models/
│   │   ├── GraphicEditorModel.ts     # Observable model (state root)
│   │   ├── GraphicObjectInterface.ts # Discriminated union of shapes
│   │   ├── ObjectFactory.ts          # Shape creation
│   │   ├── Observables.ts            # Base Observable class
│   │   └── types.ts                  # Shared type aliases
│   ├── viewModels/
│   │   ├── GraphicEditorContext.ts   # React context types
│   │   └── ContextProvider.tsx       # Controller + broadcast hook
│   ├── views/
│   │   ├── DocumentBar/              # Open/save/close + connection status
│   │   ├── Canvas/                   # SVG-like canvas area
│   │   ├── Shape/                    # Shape dispatcher + renderers
│   │   │   ├── index.tsx             # Shape switch/selector
│   │   │   ├── types.ts              # Shape view props
│   │   │   ├── Rectangle/  Ellipse/  Line/  Image/  Text/  Group/
│   │   │   └── Handlers/             # Resize + rotate handles
│   │   ├── PropertiesPanel/          # Property editor + layers
│   │   └── ToolBar/                  # Shape creation + actions
│   ├── hooks/
│   │   ├── useSubscribe.ts           # Subscribe to model changes
│   │   ├── useDrag.ts                # Mouse drag handling
│   │   └── useUpdateView.ts          # Force re-render hook
│   ├── utils/
│   │   ├── walk.ts                   # Recursive tree position update
│   │   ├── search.ts                 # Recursive tree ID search
│   │   ├── getObjectAABB.ts          # Axis-aligned bounding box
│   │   └── calculateRecursiveBoundingBox.ts  # Group bounding box
│   └── __tests__/                    # Vitest suites mirroring src/
│
├── _zettel/                          # Zettelkasten notes
├── .pi/                              # Pi coding agent config
├── index.html
├── package.json
├── tsconfig.json
└── README.md                         # You are here
```

---

## Quick Start

The repo has two halves as sibling directories: `frontend/` (React + Vite) and
`backend/` (Spring Boot). The root holds only docs and a thin script wrapper.

**Prerequisites:** Node.js 20+, npm, Java 21+, Maven 3.9+

### Both halves, one command

```bash
git clone <repo> && cd pswp-graphic-tool
npm install                  # root: installs concurrently
npm install --prefix frontend
npm run dev:all              # starts Vite and Spring Boot together
```

### Or run them separately

```bash
# Terminal 1 — backend
cd backend
mvn spring-boot:run

# Terminal 2 — frontend (from the repo root)
npm install --prefix frontend
npm run dev
```

The backend starts at `http://localhost:8080` (H2 console at `/h2-console`).
The frontend runs at `http://localhost:5173/pswp-graphic-tool/` — note the
path prefix, which comes from `base` in `frontend/vite.config.ts`.

### Root scripts

| Command | What it does |
|---|---|
| `npm run dev:all` | Vite + Spring Boot together |
| `npm run dev` | frontend only |
| `npm run dev:api` | backend only |
| `npm test` | frontend tests (vitest) |
| `npm run test:api` | backend tests (maven) |
| `npm run test:all` | both |
| `npm run lint` | eslint over the frontend |

> **Collaboration does not work yet.** The client sends binary WebSocket frames
> while the backend still extends `TextWebSocketHandler`, which rejects them with
> close code 1003. See PLAN.md.

With no backend running, the app still works in **local-only** mode — the
DocumentBar shows "Local only" and edits are kept in memory. As soon as
you click **New** or open a document from the dropdown, the frontend
contacts the backend and joins that document's collaboration room.

---

## API Reference

### REST Endpoints

All endpoints are prefixed with `/api`.

#### Documents

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| `GET` | `/documents` | List all documents | — | `DocumentSummary[]` |
| `GET` | `/documents/{id}` | Get document with content | — | `Document` |
| `POST` | `/documents` | Create document | `{ title, content? }` | `Document` (201) |
| `PUT` | `/documents/{id}` | Update document | `{ title, content? }` | `Document` |
| `DELETE` | `/documents/{id}` | Delete document | — | `204 No Content` |

#### Document Model

```json
{
  "id": "uuid",
  "title": "My Drawing",
  "content": "[ { ...GraphicObjectInterface }, ... ]",
  "createdAt": "2026-05-18T10:00:00Z",
  "updatedAt": "2026-05-18T11:00:00Z"
}
```

`content` is a JSON-encoded string. The frontend owns the shape schema;
the backend treats it as opaque text.

### WebSocket Protocol

**Endpoint:** `ws://localhost:8080/api/collaboration/{documentId}`

Each document has a "room" — clients connected to the same room receive
each other's messages. The server broadcasts every incoming message to
all peers in the room **except the sender**, so clients never need to
filter their own echoes.

#### Message Format

```json
{
  "type": "object_update",
  "data": { ... },
  "timestamp": 1716012345678
}
```

#### Message Types

| Type | `data` payload | Direction | Description |
|------|----------------|-----------|-------------|
| `object_add`    | `GraphicObjectInterface`                                | ⇄ | A new shape was created |
| `object_update` | `{ ids: string[], patch: Partial<GraphicObjectInterface> }` | ⇄ | Shape properties changed |
| `object_remove` | `string[]`                                              | ⇄ | Shapes were deleted (by ID) |
| `object_move`   | `{ ids: string[], diff: { x, y } }`                     | ⇄ | Shapes moved by delta |
| `full_state`    | `GraphicObjectInterface[]`                              | ⇄ | Full canvas sync (used after group/ungroup/reorder/undo, etc.) |
| `cursor_move`   | `{ userId?, x, y }`                                     | ⇄ | Cursor position (reserved for presence; not implemented yet) |

---

## Frontend Architecture

### Patterns

This project uses four cooperating layers:

#### 1. Observer Pattern — `GraphicEditorModel`

```ts
const model = new GraphicEditorModel();
model.subscribe(() => console.log('state changed'));
model.add('rectangle'); // triggers all subscribers
```

The model is the single source of truth. All mutation methods
(`add`, `remove`, `update`, `move`, `group`, `ungroup`, `restore`) call
`this.notify()` afterwards, which runs every registered listener.

#### 2. Command Pattern — `Command` + `CommandManager`

```ts
commandManager.executeCommand(new AddCommand('rectangle'));
commandManager.undo(); // restores previous state
commandManager.redo(); // re-executes
```

Each command snapshots the model state before executing. Undo restores
the snapshot. The `CommandWithDebounce` variant handles continuous
actions (drag, resize, rotation): a **500ms idle timer** after the last
update saves the final state, so a single drag is one undo step instead
of dozens.

#### 3. React Context — ViewModel bridge

```tsx
<SessionProvider>          {/* current document + collab channel */}
  <ContextProvider>        {/* controller + selection state */}
    <DocumentBar />
    <ToolBar />
    <Canvas />
    <PropertiesPanel />
  </ContextProvider>
</SessionProvider>
```

`ContextProvider` owns the selection (`selectedIds`) — selection is
client-local and not part of the shared model. It wraps each controller
function so that mutations go through `commandManager` for undo/redo
and through `SessionContext.broadcast` for collaboration.

#### 4. Session — `SessionProvider`

Owns the **lifecycle of an open document**: which one, the WebSocket
channel, and the list of available documents. Outbound mutations call
`broadcast(...)`. Inbound messages go through `applyRemoteMessage(...)`,
which mutates the model directly — bypassing the controller layer, so
remote changes never trigger another broadcast.

### Data Flow

```
Local edit:
  ToolBar / Canvas
    → Controller.add('rectangle')
      → AddCommand → commandManager.executeCommand(cmd)
        → cmd.execute() snapshots model, then model.add('rectangle')
          → model.notify() → useSubscribe → React re-renders
      → broadcast('object_add', addedObject)
        → CollaborationClient.send → WebSocket → server fans out to peers
```

```
Remote edit (peer broadcasts a change):
  WebSocket message arrives
    → CollaborationClient.onmessage
      → applyRemoteMessage(msg)
        → model.<mutate>(...) directly (no controller, no rebroadcast)
          → model.notify() → React re-renders
```

```
User drags a shape:
  Canvas → useDrag → Controller.move(diff)
    → CommandWithDebounce (first move only) execute() snapshots model
    → model.move(selectedIds, diff)
    → broadcast('object_move', { ids: selectedIds, diff })
    → After 500ms idle → cmd.setDoneStates() records final state
```

---

## Development Notes

### Adding a New Shape Type

1. **Model:** Add a new interface in `models/GraphicObjectInterface.ts` and
   add it to the `GraphicObjectType` union.
2. **Factory:** Add a case in `models/ObjectFactory.ts`.
3. **View:** Create a new component in `views/Shape/<Type>/`, following the
   existing pattern (forwardRef, `ShapeViewProps`).
4. **Dispatcher:** Add a case in `views/Shape/index.tsx`.
5. **Properties:** Handle the new type in `views/PropertiesPanel/Properties/index.tsx`.

### Debounce Strategy for Continuous Actions

The `CommandWithDebounce` class handles drag/resize/rotate:

1. First mouse event → create `CommandWithDebounce`, execute it (snapshot state)
2. Every subsequent event during the gesture → update the model directly (no new command)
3. After 500ms of inactivity → `setDoneStates()` records the final state for undo
4. On undo → restore the pre-drag snapshot

This prevents hundreds of tiny undo steps from a single drag.

### Tests

```bash
npm test                                  # from the repo root
npm --prefix frontend run test:watch      # watch mode
```

The suite covers models, commands, hooks, utilities, the API client,
the collaboration client, and the session layer.

---

## Future Work

- [ ] **Authentication** — Add JWT-based user auth to the backend
- [ ] **Composite Pattern** — Proper tree-based grouping (currently array-based)
- [ ] **Layer reordering** — Drag-and-drop in Layers panel (partial implementation exists)
- [ ] **Export** — SVG/PNG export of the canvas
- [ ] **Snap-to-grid** — Alignment helpers
- [ ] **Collaborative cursors** — Use the reserved `cursor_move` message to show peer positions
- [ ] **Image upload** — Multipart upload endpoint (config exists; controller is TODO)
- [ ] **Operational transforms / CRDT** — Replace `full_state` fallback for group/undo with proper merge
