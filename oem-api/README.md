# OEM API (NestJS)

Starter service for User Story 4.1.1 – Operations & Execution Management (OEM) module.

## Features

- NestJS 10 + TypeScript with modular structure (`AppModule` + `OemModule`).
- REST endpoints (stubbed) for health checks and OEM connectivity tests.
- Swagger/OpenAPI available at `/api/docs` with JWT bearer configuration ready.
- Global validation pipeline, CORS, Helmet, and API prefix (`/api`).
- Prepared for future IAM/RBAC/ABAC integration and database wiring (TypeORM/Prisma).

## Scripts

```bash
npm install
npm run start:dev
```

## Test Endpoints

- `GET /api/health` – Service liveness.
- `GET /api/oem/ping` – OEM module placeholder response.

Next steps include adding JWT/OIDC guard middleware, fleshing out CRUD operations, and connecting to the chosen persistence layer.

## Operation Plans (User Story 4.1.2)

- Preview (no persistence): `POST /api/oem/operation-plans/preview` with body `{ "date": "2025-12-08", "algorithm": "single-crane" }`.
- Persist for day: `POST /api/oem/operation-plans/generate` with body `{ "date": "2025-12-08", "algorithm": "single-crane" }`.
- Algorithms (hardcoded for now):
  - `single-crane` (default): sequential unload/load using one crane per VVN, 2 min/container.
  - `multi-crane`: parallelizes (two cranes) to cut duration roughly in half to reduce delays.
- Metadata recorded automatically on persist: `algorithmUsed`, `createdBy` (from JWT if present, else `system`), and `createdAt`.
- Plans include per-VVN operations with resources/time windows and are generated from approved VVNs; if there are no VVNs for the date, the endpoint returns an empty list.

## Migrating & seeding

Run the TypeORM migrations (they also insert demo operation plans) with:

```bash
npm run migration:run
```

To revert the last migration:

```bash
npm run migration:revert
```
