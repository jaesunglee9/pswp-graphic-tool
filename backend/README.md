# PSWP Graphic Tool — Backend

> Java Spring Boot 3.4 backend for the collaborative vector graphics editor.

---

## Quick Start

```bash
cd backend
mvn spring-boot:run
```

Server starts at **`http://localhost:8080`**  
H2 console: **`http://localhost:8080/h2-console`** (JDBC URL: `jdbc:h2:mem:graphiceditor`)

## API Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents` | GET | List all documents |
| `/api/documents/{id}` | GET | Get a document with full content |
| `/api/documents` | POST | Create a document |
| `/api/documents/{id}` | PUT | Update a document |
| `/api/documents/{id}` | DELETE | Delete a document |
| `/api/collaboration/{id}` | WebSocket | Real-time collaboration room |

## Architecture

```
Controller → Service → Repository → JPA → H2 (dev) / PostgreSQL (prod)
```

**Key packages:**

| Package | Responsibility |
|---------|---------------|
| `config` | CORS, WebSocket routing |
| `controller` | REST endpoints |
| `model` | JPA entities, DTOs |
| `repository` | Spring Data JPA interfaces |
| `service` | Business logic |
| `websocket` | Real-time collaboration handler |

## Building for Production

```bash
mvn package -DskipTests
java -jar target/graphic-tool-backend-1.0.0.jar
```

For PostgreSQL, set these environment variables:

```bash
export SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/graphiceditor
export SPRING_DATASOURCE_USERNAME=postgres
export SPRING_DATASOURCE_PASSWORD=secret
```