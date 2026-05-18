# Session: 2026-05-18 — Full-stack rewrite of PSWP Graphic Tool

## Notes Written

- [[20260518-1055 | Project analysis for backend/frontend rewrite]]
- [[20260518-1058 | Backend architecture — Java Spring Boot]]
- [[20260518-1059 | Frontend refactoring — added API + collaboration layers]]
- [[20260518-1436 | Integration completed — Session layer wires API + WebSocket to model]]

## Themes

- **Client-server split** — from pure client-side to Spring Boot backend + React frontend
- **Clean architecture** — Layered backend (Controller → Service → Repository), observer + command patterns on frontend
- **Real-time collaboration** — WebSocket rooms for multi-user editing
- **Documentation-first** — Comprehensive README, API spec, architecture diagrams, in-code JSDoc/JavaDoc

## What Was Built

### Backend (Java Spring Boot 3.4)
- REST API for document CRUD at `/api/documents`
- WebSocket collaboration at `/api/collaboration/{documentId}`
- JPA entity model with H2 (dev) / PostgreSQL (prod)
- CORS configured for Vite dev server
- Full API reference in the README

### Frontend (TypeScript/React 19)
- `src/api/client.ts` — Generic HTTP client with error handling
- `src/api/documentApi.ts` — Typed document CRUD functions
- `src/collaboration/CollaborationClient.ts` — WebSocket with auto-reconnect

### Documentation
- Comprehensive README.md with architecture diagram, data flow, project structure
- Backend README with API summary and build instructions
- In-code documentation (JSDoc/JavaDoc)
- This zettelkasten of development notes
