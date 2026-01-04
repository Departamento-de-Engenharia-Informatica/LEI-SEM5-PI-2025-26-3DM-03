#  US 4.1.15 – Manage Complementary Tasks

## 1. Requirements Engineering

### 1.1. User Story Description
As a Logistics Operator, I want to create, update, search, and complete Complementary Tasks associated with Vessel Visit Executions (VVEs), so that additional work items (parallel or suspending operations) are tracked with proper timing and responsibility.

---

### 1.2. Customer Specifications and Clarifications
- The SPA provides a "Complementary Tasks" page with:
  - list/search with filters
  - create task
  - edit task
  - delete task
- Complementary tasks reference:
  - a category (`categoryId`) managed under US 4.1.14
  - a vessel visit execution (`vveId`) from US 4.1.10
- Supported filters in UI/API:
  - `vesselIdentifier` (free text)
  - `status` (`ONGOING | COMPLETED`)
  - time range `from` / `to`
- Task fields:
  - `team` (required)
  - `mode` (`PARALLEL | SUSPENDS`) determining whether tasks run alongside ops or suspend operations
  - `startTime` (required)
  - `endTime` (optional; when present marks the task as completed)
- UI validation rules:
  - category, VVE, team, and start time are mandatory for creation.
  - if the operator chooses to create/edit as completed, `endTime` becomes required.
  - time inputs are collected as `datetime-local` and converted to ISO strings before API calls.
- Calls are executed through the TodoApi proxy (`/api/oem/complementary-tasks*`).

---

### 1.3. Acceptance Criteria

| ID  | Acceptance Criterion                                                              | Status      |
|-----|------------------------------------------------------------------------------------|-------------|
| AC1 | API supports CRUD operations for complementary tasks.                               | Implemented |
| AC2 | API supports filtering tasks by vessel identifier, status, and time range.          | Implemented |
| AC3 | SPA provides a management UI with validation for create/edit/complete flows.        | Implemented |

---

### 1.4. Dependencies

| Dependency                               | Description                                                                 |
|------------------------------------------|-----------------------------------------------------------------------------|
| OEM service (NestJS)                     | Owns complementary task persistence and business rules                        |
| TodoApi `OemProxyController`             | Proxies `/api/oem/complementary-tasks*` calls to OEM                          |
| IAM / Auth cookies/JWT                   | Required by TodoApi `[Authorize]`                                            |
| Complementary Task Categories (US 4.1.14)| Provides category catalog referenced by tasks                                 |
| Vessel Visit Executions (US 4.1.10)      | Tasks are associated to a VVE (`vveId`)                                       |

---

### 1.5. Input and Output Data

**Input (SPA → API):**
- `GET /api/oem/complementary-tasks` query:
  - `vveId` *(number, optional)*
  - `vesselIdentifier` *(string, optional)*
  - `status` *(enum, optional)* – `ONGOING | COMPLETED`
  - `from` *(string, optional)*
  - `to` *(string, optional)*
- `POST /api/oem/complementary-tasks` body:
  - `categoryId` *(number, required)*
  - `vveId` *(number, required)*
  - `team` *(string, required)*
  - `mode` *(enum, required)* – `PARALLEL | SUSPENDS`
  - `startTime` *(ISO string, required)*
  - `endTime` *(ISO string, optional)*
- `PATCH /api/oem/complementary-tasks/{id}` body (all optional):
  - `categoryId`, `team`, `mode`, `startTime`, `endTime` (nullable)

**Output (API → SPA):**
- `ComplementaryTaskDTO` including:
  - `id`, `identifier`, `categoryId`, `vveId`, `team`, `mode`, `startTime`, `endTime?`
  - derived/status fields: `durationMinutes?`, `status`, `isImpactingNow`
  - metadata: `createdBy`, `createdAt`, `updatedAt`

---

### 1.6. Main Endpoints

| Method | Endpoint                            | Description                                    | Example |
|-------:|--------------------------------------|------------------------------------------------|---------|
| GET    | /api/oem/complementary-tasks         | List tasks with optional filters               | `/api/oem/complementary-tasks?status=ONGOING&vesselIdentifier=IMO123` |
| GET    | /api/oem/complementary-tasks/{id}    | Get task by id                                 | `/api/oem/complementary-tasks/7` |
| POST   | /api/oem/complementary-tasks         | Create task                                    | `/api/oem/complementary-tasks` |
| PATCH  | /api/oem/complementary-tasks/{id}    | Update task                                    | `/api/oem/complementary-tasks/7` |
| DELETE | /api/oem/complementary-tasks/{id}    | Delete task                                    | `/api/oem/complementary-tasks/7` |

---

### 1.7. Example Requests (Postman)
```
# List tasks for a vessel in a period
GET /api/oem/complementary-tasks?vesselIdentifier=IMO123&from=2025-05-01T00:00:00Z&to=2025-05-07T23:59:59Z

# Create ongoing task
POST /api/oem/complementary-tasks
Content-Type: application/json
{
  "categoryId": 1,
  "vveId": 10,
  "team": "Maintenance Team A",
  "mode": "PARALLEL",
  "startTime": "2025-05-06T09:00:00Z"
}

# Create completed task
POST /api/oem/complementary-tasks
Content-Type: application/json
{
  "categoryId": 2,
  "vveId": 10,
  "team": "Safety",
  "mode": "SUSPENDS",
  "startTime": "2025-05-06T10:00:00Z",
  "endTime": "2025-05-06T10:30:00Z"
}

# Mark task completed
PATCH /api/oem/complementary-tasks/7
Content-Type: application/json
{
  "endTime": "2025-05-06T12:00:00Z"
}

# Delete
DELETE /api/oem/complementary-tasks/7
```

---

### 1.8. Bootstrap Data (Seeding)
- No mandatory seeding. Requires categories and VVEs to exist.

---

### 1.9. System Architecture (Summary)
- **Frontend:** Angular `ComplementaryTasksComponent` uses `ComplementaryTasksService` plus reference data from `ComplementaryTaskCategoriesService` and `OemApiService.getVesselVisitExecutions()`.
- **Gateway:** TodoApi `OemProxyController` proxies `/api/oem/complementary-tasks*`.
- **OEM service:** NestJS `ComplementaryTaskController` implements filtering and CRUD.

---

### 1.10. Remarks
- The UI treats `endTime` as the completion flag: setting an end time transitions the task to `COMPLETED`.
- The ARQSI PlantUML files under `Docs/Sprint C/arqsi/US 4.1.15` are mislabeled and should be corrected if they are meant to describe this feature.
