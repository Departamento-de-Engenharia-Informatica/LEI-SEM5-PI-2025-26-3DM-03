#  US 4.1.2 – Generate Operation Plans

## 1. Requirements Engineering

### 1.1. User Story Description
As a Logistics Operator, I want to automatically generate and store Operation Plans for all Vessel Visit Notifications (VVNs) scheduled for a given day using one of the available scheduling algorithms, so that cargo operations are efficiently organized and can later be monitored or adjusted.

---

### 1.2. Customer Specifications and Clarifications
- Only roles **logistics-operator** and **admin** can access the Operation Plans generation screen.
- The operator selects a target date and an algorithm (`single-crane`, `multi-crane`, ...). Optional manual selection of VVNs allows focusing on a subset.
- Previewing plans calls `/api/oem/operation-plans/preview`, which delegates to the OEM scheduler and returns unsaved plan candidates.
- Preview results contain operations per VVN (crane, start/end times, expected delay) so the operator can confirm before persisting.
- Saving invokes `/api/oem/operation-plans/generate`, persisting the generated plans in the OEM module and returning stored plans.
- The UI tags persisted plans with metadata such as `createdAt`, `createdBy`, and `algorithmUsed` (coming from OEM response) for later auditing.
- Generation respects existing plans: attempting to overwrite an existing day triggers a `409 Conflict` warning so the operator can decide whether to regenerate missing plans instead.
- Missing-plan workflows rely on `/api/oem/operation-plans/missing` plus `/regenerate-missing`, ensuring full coverage for the selected day.
- Date pickers use UTC ISO strings to keep OEM and PLMS aligned across time zones.

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
| OEM Planning & Scheduling Service          | Owns generation algorithms and stores final Operation Plans                     |
| TodoApi OemProxyController / OemClient     | Backend proxy that forwards preview/generate requests to OEM                    |
| IAM / Identity Provider                    | Supplies authentication tokens/cookies for SPA and API                         |
| Vessel Visit Notifications (VVNs) service  | Source for the list of VVNs eligible for planning on a given date              |
| Resource Catalogs (docks, cranes, staff)   | Provide reference data displayed in the preview and persisted in plans         |

---

### 1.5. Input and Output Data
**Input (SPA → API):**
- `POST /api/oem/operation-plans/preview`
  - `date` *(string, required)* – ISO day (e.g., `2025-11-23`).
  - `algorithm` *(string, required)* – scheduling algorithm identifier.
  - `vvnIds` *(number[], optional)* – subset of VVNs when not generating all for the day.
- `POST /api/oem/operation-plans/generate`
  - Same payload as preview; when `vvnIds` is omitted all VVNs for the date are generated.

**Output (API → SPA):**
- Preview: `OperationPlanPreviewDto[]`
  - `vvnId`, `vesselName`, `dockId`, `plannedStartTime`, `plannedEndTime`, `expectedDelayMinutes`, `algorithmUsed`, `operations[]` (task previews).
- Generate: `OperationPlanDto[]`
  - Persistent plan metadata: `id`, `name`, `status`, `dockId`, `targetDay`, `algorithmUsed`, `createdAt`, `createdBy`, plus stored tasks and change logs (empty on creation).
- Conflict responses: HTTP `409` on duplicate days, HTTP `200` with warnings array when only part of the day can be persisted.

---

### 1.6. Main Endpoints

| Method | Endpoint                                           | Description                                                                 | Example                                                                                |
|-------:|-----------------------------------------------------|-----------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| POST   | /api/oem/operation-plans/preview                    | Generates unsaved plans for the selected day and algorithm.                 | `/api/oem/operation-plans/preview`                                                     |
| POST   | /api/oem/operation-plans/generate                   | Persists generated plans into OEM storage.                                  | `/api/oem/operation-plans/generate`                                                    |
| GET    | /api/oem/operation-plans                            | Lists stored plans (used to confirm persistence).                           | `/api/oem/operation-plans?from=2025-11-23&to=2025-11-23`                               |
| GET    | /api/oem/operation-plans/missing?date=YYYY-MM-DD    | Identifies VVNs without plans to help complete coverage.                    | `/api/oem/operation-plans/missing?date=2025-11-23`                                     |
| POST   | /api/oem/operation-plans/regenerate-missing         | Regenerates only missing plans, optionally overwriting conflicts.           | `/api/oem/operation-plans/regenerate-missing`                                          |
| GET    | /api/oem/vessel-visit-executions?vesselVisitId=...  | Supports validation by showing related executions linked to generated plans.| `/api/oem/vessel-visit-executions?from=2025-11-23&to=2025-11-24&status=scheduled`      |

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
- No static seeding. Plans originate from on-demand generation or OEM batch jobs.
- For integration testing, seeded VVNs include realistic ETA/ETD and cargo volume so algorithms can compute windows.

---

### 1.9. System Architecture (Summary)
- **Frontend:** Angular component `OemOperationPlansComponent` orchestrates preview and generate flows via reactive forms and `OemApiService`.
- **Backend:** `OemProxyController` exposes `/preview`, `/generate`, `/missing`, `/regenerate-missing` endpoints, delegating to `OemClient`.
- **OEM Service:** Executes selected algorithm, allocates cranes/staff, and persists the resulting Operation Plans with metadata.
- **Security:** All calls require authenticated sessions; TodoApi forwards identity headers/cookies to OEM.
- **Audit:** OEM stores `createdAt`, `createdBy`, `algorithmUsed`, and change logs; SPA surfaces these in the saved plans list.

---

### 1.10. Remarks
- Preview tables highlight expected delays and resource assignments, letting operators deselect problematic VVNs before persisting.
- `generateOperationPlans` refreshes the saved plans grid after success so operators immediately see stored metadata.
- Error handling differentiates between network failures (`status 0`), conflicts (`409`), and validation errors; the UI shows context-specific messages.
- Regeneration workflows encourage operators to confirm overwriting existing plans to prevent data loss.
- Dates use the `todayIso()` helper (UTC midnight) ensuring consistent scheduling windows regardless of client locale.
