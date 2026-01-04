# US 4.1.2 – Generate Operation Plans

## 1. Requirements Engineering

### 1.1. User Story Description
As a Logistics Operator, I want to automatically generate and store Operation Plans for all Vessel Visit Notifications (VVNs) scheduled for a given day using one of the available scheduling algorithms, so that cargo operations are efficiently organized and can later be monitored or adjusted.

---

### 1.2. Customer Specifications and Clarifications
- Only roles **logistics-operator** and **admin** can access the Operation Plans generation screen and endpoints.
- The operator selects a target day (`YYYY-MM-DD`) and optionally an algorithm (`single-crane`, `multi-crane`). The algorithm defaults to `single-crane`.
- Optional manual selection of VVNs is supported by sending `vvnIds` to limit the preview/generation to a subset.
- Previewing plans calls `/api/oem/operation-plans/preview`, which generates unsaved plan candidates for the selected day.
- Preview results contain operations per VVN (crane, storage area, staff, start/end times, expected delay) so the operator can confirm before persisting.
- Saving invokes `/api/oem/operation-plans/generate`, which persists the generated plans and returns stored entities.
- Persisted plans include audit metadata (`createdAt`, `createdBy`, `algorithmUsed`, `status=PLANNED`) and planned time windows.
- Generation is protected against overwrites: if plans already exist for the day, `/generate` returns `409 Conflict`. Regeneration requires `/regenerate-missing` with `confirmOverwrite=true`.
- `multi-crane` requires at least two active cranes; otherwise the API responds with `400 Bad Request`.
- Day boundaries are evaluated in UTC (`YYYY-MM-DDT00:00:00Z` to `YYYY-MM-DDT23:59:59Z`).

---

### 1.3. Acceptance Criteria

| ID  | Acceptance Criterion                                                                                                           | Status        |
|-----|-------------------------------------------------------------------------------------------------------------------------------|---------------|
| AC1 | Operator can choose the target day and scheduling algorithm before generation.                                                | Implemented   |
| AC2 | Planning & Scheduling module produces preview plans that aggregate operations, resources, and time windows per VVN.          | Implemented   |
| AC3 | SPA displays generated plans before saving and lets the operator persist them into the OEM module.                            | Implemented   |
| AC4 | Persisted Operation Plans store metadata (creation date, author, algorithm) for auditing and later adjustments.               | Implemented   |
| AC5 | System prevents accidental overwrites and guides the user through regenerating or filling missing plans when conflicts arise. | Implemented   |

---

### 1.4. Dependencies

| Dependency                                 | Description                                                                     |
|--------------------------------------------|---------------------------------------------------------------------------------|
| OEM Operation Planning API (NestJS)        | Owns generation algorithms and persists Operation Plans                         |
| IAM / Identity Provider                    | Supplies authentication context for `createdBy` and role checks                 |
| Vessel Visit Notifications (TodoApi)       | Source of approved VVNs for the selected day                                    |
| Resource Catalogs (Resources/Staff/Storage)| Provide available cranes, staff, and storage areas for scheduling               |
| OEM Database (TypeORM)                     | Stores operation plans, tasks, and audit metadata                               |

---

### 1.5. Input and Output Data
**Input (SPA -> OEM API):**
- `POST /api/oem/operation-plans/preview`
  - `date` *(string, required)* – target day (`YYYY-MM-DD`).
  - `algorithm` *(string, optional)* – scheduling algorithm identifier (defaults to `single-crane`).
  - `vvnIds` *(number[], optional)* – subset of VVNs to include.
- `POST /api/oem/operation-plans/generate`
  - Same payload as preview; when `vvnIds` is omitted all approved VVNs for the day are generated.
- `GET /api/oem/operation-plans/missing?date=YYYY-MM-DD`
  - `date` *(string, required)* – target day (`YYYY-MM-DD`).
- `POST /api/oem/operation-plans/regenerate-missing`
  - `date` *(string, required)* – target day (`YYYY-MM-DD`).
  - `algorithm` *(string, optional)* – scheduling algorithm identifier.
  - `confirmOverwrite` *(boolean, required)* – must be `true` when existing plans are present.

**Output (API -> SPA):**
- Preview: `OperationPlanPreviewDto[]`
  - `vvnId`, `vesselName`, `dockId`, `plannedStartTime`, `plannedEndTime`, `expectedDelayMinutes`, `algorithmUsed`, `operations[]`.
  - `operations[]` includes `type`, `craneId`, `storageAreaId`, `staffIds`, `startTime`, `endTime`.
- Generate/Regenerate: `OperationPlanEntity[]`
  - `id`, `name`, `description`, `status`, `vesselVisitId`, `sourceVvnId`, `dockId`,
    `plannedStartTime`, `plannedEndTime`, `targetDay`, `algorithmUsed`, `createdAt`, `createdBy`,
    plus `tasks[]` (created from preview operations).
- Conflict responses: HTTP `409` when plans already exist (`/generate`) or when regeneration requires confirmation (`/regenerate-missing`).
- Validation responses: HTTP `400` when date is invalid or when `multi-crane` lacks two active cranes.

---

### 1.6. Main Endpoints

| Method | Endpoint                                           | Description                                                                 | Example                                                                                |
|-------:|-----------------------------------------------------|-----------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| POST   | /api/oem/operation-plans/preview                    | Generates unsaved plans for the selected day and algorithm.                 | `/api/oem/operation-plans/preview`                                                     |
| POST   | /api/oem/operation-plans/generate                   | Persists generated plans for the selected day.                              | `/api/oem/operation-plans/generate`                                                    |
| GET    | /api/oem/operation-plans                            | Lists stored plans (filter by date or vessel visit).                        | `/api/oem/operation-plans?from=2025-11-23&to=2025-11-23`                               |
| GET    | /api/oem/operation-plans/missing?date=YYYY-MM-DD    | Identifies VVNs without plans to help complete coverage.                    | `/api/oem/operation-plans/missing?date=2025-11-23`                                     |
| POST   | /api/oem/operation-plans/regenerate-missing         | Regenerates plans for the day, overwriting only when confirmed.             | `/api/oem/operation-plans/regenerate-missing`                                          |

---

### 1.7. Example Requests (Postman)
```
# Preview all plans for 23 Nov 2025 using single crane algorithm
POST /api/oem/operation-plans/preview
Content-Type: application/json
{
  "date": "2025-11-23",
  "algorithm": "single-crane"
}

# Persist previewed plans for a subset of VVNs
POST /api/oem/operation-plans/generate
Content-Type: application/json
{
  "date": "2025-11-23",
  "algorithm": "multi-crane",
  "vvnIds": [1201, 1205, 1210]
}

# Check stored plans and metadata
GET /api/oem/operation-plans?from=2025-11-23&to=2025-11-23

# List VVNs still missing plans for the day
GET /api/oem/operation-plans/missing?date=2025-11-23

# Regenerate missing plans confirming overwrite
POST /api/oem/operation-plans/regenerate-missing
Content-Type: application/json
{
  "date": "2025-11-23",
  "algorithm": "single-crane",
  "confirmOverwrite": true
}
```

---

### 1.8. Bootstrap Data (Seeding)
- OEM API seeds sample Operation Plans in non-production to support UI testing (`ensureDevSeed`).
- VVN sourcing falls back to OEM-local records or a small demo set (e.g., dates `2025-12-15` and `2025-12-16`) when TodoApi is unavailable.

---

### 1.9. System Architecture (Summary)
- **Frontend:** Angular component `OemOperationPlansComponent` orchestrates preview and generate flows via `OemApiService` (`/api/oem/operation-plans`).
- **Backend:** NestJS `OperationPlanController` handles `/preview`, `/generate`, `/missing`, `/regenerate-missing` and persists plans via TypeORM.
- **Scheduling:** OEM service loads approved VVNs, groups them by dock, and computes task windows per algorithm.
- **External data:** VVNs are fetched from TodoApi (approved status) with OEM-local and demo fallbacks; resources/staff/storage are pulled from their APIs.
- **Audit:** OEM stores `createdAt`, `createdBy`, `algorithmUsed`, plus tasks for each plan; SPA surfaces these in the saved plans list.

---

### 1.10. Remarks
- Preview tables highlight expected delays and resource assignments, letting operators deselect problematic VVNs before persisting.
- `generateOperationPlans` refreshes the saved plans grid after success so operators immediately see stored metadata.
- Error handling differentiates between network failures (`status 0`), conflicts (`409`), and validation errors (`400`); the UI shows context-specific messages.
- Regeneration workflows require `confirmOverwrite=true` to prevent unintended data loss.
- `single-crane` uses a 2 min/container rate with a 60 min minimum; `multi-crane` halves duration and splits unload/load between two cranes.
