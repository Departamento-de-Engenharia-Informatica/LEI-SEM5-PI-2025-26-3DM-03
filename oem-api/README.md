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
