#  US 4.1.1 – OEM Independent Service

## 1. Requirements Engineering

### 1.1. User Story Description
As a Project Manager, I want the team to develop Operations & Execution Management (OEM) module as an independent back-end service so that the system architecture remains modular, decentralized, and maintainable, allowing each component to evolve independently while ensuring seamless integration with existing modules.

---

### 1.2. Customer Specifications and Clarifications
- OEM is delivered as a standalone NestJS microservice exposing a REST API, containerised independently of the core TodoApi.
- Each domain aggregate (Operation Plan, Vessel Visit Execution, Planned Operation, Executed Operation, Resource Allocation, Change Log) has its own controller, service, repository, and DTO mappers following layered architecture best practices.
- TypeORM handles persistence (SQLite for local dev, SQL Server/PostgreSQL in production). Database access is internal to OEM; consuming modules interact strictly via REST.
- API uses DTO validation (`class-validator`) and transformation to enforce contracts and prevent leakage of persistence models.
- Authentication relies on existing IAM (Sprint B) through JWT bearer tokens / cookies; authorization uses RBAC/ABAC policies enforced by Nest guards and decorators.
- Swagger/OpenAPI is generated at `/docs`, describing all endpoints, parameters, response schemas, and error codes. Specification is exported as `openapi.yaml` for clients.
- Inter-service communication pattern: TodoApi (proxy) -> OEM API via HTTPS. No shared database or direct ORM access between modules.
- Observability is included via structured logging and health checks at `/health`.

---

### 1.3. Acceptance Criteria

| ID  | Acceptance Criterion                                                                                              | Status        |
|-----|--------------------------------------------------------------------------------------------------------------------|---------------|
| AC1 | OEM module deployed as an autonomous backend service following architectural best practices.                      | Implemented   |
| AC2 | Service exposes REST CRUD endpoints for all managed business concepts (plans, executions, operations, resources).  | Implemented   |
| AC3 | Public API documented with Swagger/OpenAPI and accessible through `/docs`.                                        | Implemented   |
| AC4 | Communication with other modules occurs exclusively via REST calls; no shared database usage.                     | Implemented   |
| AC5 | Authentication & authorization integrated with IAM, applying RBAC/ABAC policies aligned with Sprint B approach.    | Implemented   |

---

### 1.4. Dependencies

| Dependency                     | Description                                                                           |
|--------------------------------|---------------------------------------------------------------------------------------|
| Identity & Access Management   | OAuth2/OIDC provider issuing JWT/cookies consumed by OEM guards                        |
| TodoApi Gateway                | Consumes OEM REST endpoints and forwards identity context                             |
| Resource Catalog Services      | Supplies reference data (docks, cranes, staff) fetched via REST from OEM schedulers    |
| Scheduling Engine              | OEM internal module responsible for generating operation plans                        |
| Observability Stack (ELK/APM)  | Collects logs and metrics emitted by OEM                                               |

---

### 1.5. Input and Output Data
**Input:**
- REST JSON payloads for CRUD operations, e.g. `CreateOperationPlanDto`, `UpdateVesselVisitExecutionDto`, `CreateResourceDto`.
- Authentication headers: `Authorization: Bearer <token>` plus optional tenant/role claim headers for ABAC enforcement.

**Output:**
- Resource representations (`OperationPlanDto`, `VesselVisitExecutionDto`, `PlannedOperationDto`, `ExecutedOperationDto`, `ResourceAllocationDto`).
- Paginated collections using `page`, `pageSize`, `total` metadata.
- Error contracts with `status`, `code`, `message`, `details` fields to support client handling.

---

### 1.6. Main Endpoints

| Method | Endpoint                                            | Description                                                                | Example                                                                               |
|-------:|------------------------------------------------------|----------------------------------------------------------------------------|---------------------------------------------------------------------------------------|
| GET    | /api/operation-plans                                 | List plans (filters: `date`, `vesselVisitId`, `status`).                    | `/api/operation-plans?date=2025-11-23`                                                |
| POST   | /api/operation-plans                                 | Create new plan from scheduling payload.                                   | `/api/operation-plans`                                                                |
| GET    | /api/operation-plans/{id}                            | Retrieve plan details with tasks & logs.                                   | `/api/operation-plans/42?includeTasks=true`                                           |
| PATCH  | /api/operation-plans/{id}                            | Update status/resources/timeline of a plan.                                | `/api/operation-plans/42`                                                             |
| DELETE | /api/operation-plans/{id}                            | Remove/cancel a plan (soft delete).                                       | `/api/operation-plans/42`                                                             |
| GET    | /api/vessel-visit-executions                         | List executions (filters: `status`, `from`, `to`).                          | `/api/vessel-visit-executions?status=in-progress`                                     |
| POST   | /api/vessel-visit-executions                         | Create execution record linked to a VVN.                                   | `/api/vessel-visit-executions`                                                        |
| PATCH  | /api/vessel-visit-executions/{id}                    | Update execution actual timings, dock assignments.                         | `/api/vessel-visit-executions/100`                                                    |
| GET    | /api/resources                                       | CRUD on managed resources (cranes, staff).                                 | `/api/resources?type=crane`                                                           |
| GET    | /api/resource-allocations                            | Inspect resource allocation for conflicts.                                 | `/api/resource-allocations?resourceType=crane&from=2025-11-23&to=2025-11-24`          |
| GET    | /docs                                                | Swagger UI with OpenAPI spec download.                                     | `/docs`                                                                               |
| GET    | /health                                              | Liveness / readiness health check.                                         | `/health`                                                                             |

---

### 1.7. Example Requests (Postman)
```
# Create operation plan
POST /api/operation-plans
Authorization: Bearer <token>
Content-Type: application/json
{
  "vvnId": 1201,
  "algorithm": "single-crane",
  "tasks": [
    {
      "type": "load",
      "craneId": "CR-09",
      "storageAreaId": "SA-11",
      "staffIds": ["ST-220", "ST-337"],
      "startTime": "2025-11-23T08:00:00Z",
      "endTime": "2025-11-23T10:30:00Z"
    }
  ]
}

# Update vessel visit execution actual times
PATCH /api/vessel-visit-executions/450
Authorization: Bearer <token>
Content-Type: application/json
{
  "actualBerthTime": "2025-11-23T07:45:00Z",
  "dockId": "D1"
}

# Retrieve OpenAPI specification
GET /docs-json
Authorization: Bearer <token>
```

---

### 1.8. Bootstrap Data (Seeding)
- Seed scripts create baseline resources (cranes, docks, staff roles) and demo plans to support integration with TodoApi and frontend during Sprint C.
- Admin account seeded with `logistics-operator` and `admin` roles for initial access; tokens issued by IAM sandbox tenant.

---

### 1.9. System Architecture (Summary)
- **Service:** NestJS modular architecture with domain-driven modules (`PlansModule`, `ExecutionsModule`, `ResourcesModule`, etc.), using dependency injection and shared guards/interceptors.
- **Persistence:** TypeORM repositories, migrations for schema evolution, SQLite/PostgreSQL providers per environment.
- **API Surface:** REST controllers returning DTOs, decorated with Swagger metadata. Versioning via `/api/v1` prefix.
- **Security:** Global authentication guard (JWT strategy) + policy-based authorization guard evaluating RBAC/ABAC claims. Requests log correlation IDs.
- **Integration:** TodoApi uses `OemClient` to call OEM endpoints; other modules rely on documented REST contracts. No direct DB coupling.
- **Deployment:** Containerised (Dockerfile) with environment configuration for DB, IAM endpoints, CORS settings.

---

### 1.10. Remarks
- Circuit breaker / retry policies will be enforced at the TodoApi proxy to shield clients from transient OEM outages.
- Continuous integration runs `npm run lint`, `npm run test`, and `npm run build`, publishing OpenAPI schema as artifact.
- Maintaining backwards-compatible contracts is mandatory; breaking changes require version bump (e.g., `/api/v2`).
- Feature toggles allow enabling advanced algorithms without redeploying dependent services.
- Health and metrics endpoints integrate with the platform monitoring (Prometheus exporters planned for next sprint).
