#  US 4.1.11 – Record Executed Operations for a Vessel Visit Execution

## 1. Requirements Engineering

### 1.1. User Story Description
As a Logistics Operator, I want to record the execution status and real timestamps/resources of planned operations for a Vessel Visit Execution (VVE), so that the system reflects what was actually executed and supports reporting/audit.

---

### 1.2. Customer Specifications and Clarifications
- The SPA provides execution detail views where the operator can inspect planned operations and register execution data per operation.
- Planned operations are retrieved from the VVE context using `GET /api/oem/vessel-visit-executions/{id}/planned-operations`.
- Already recorded executed operations are retrieved using `GET /api/oem/vessel-visit-executions/{id}/executed-operations`.
- The UI merges both datasets by `plannedOperationId` so each row shows planned data plus the latest execution data.
- Operators can update execution data with an upsert operation:
  - `PUT /api/oem/vessel-visit-executions/{id}/executed-operations/{plannedOperationId}`
  - payload supports `actualStartTime`, `actualEndTime`, `resourcesUsed` (JSON object)
- Client-side validation in the SPA:
  - Time range validation: start must be before end.
  - When marking an operation as completed (status-based UI), end time becomes required.
  - `resourcesUsed` must parse as JSON and must be a JSON object (not an array).
  - At least one of the fields must be provided to submit an update.
- Role constraints:
  - Backend endpoints are protected for `admin` and `logistics-operator`.
  - UI further restricts editing for non-admins to executions in `in-progress`/`active` state.
- If a VVE has no associated Operation Plan, planned operations are unavailable; the UI shows an explicit message and execution logging is limited.

---

### 1.3. Acceptance Criteria

| ID  | Acceptance Criterion                                                                 | Status      |
|-----|---------------------------------------------------------------------------------------|-------------|
| AC1 | API supports retrieving planned operations for an execution.                          | Implemented |
| AC2 | API supports retrieving executed operations already recorded for an execution.        | Implemented |
| AC3 | API supports upserting execution data per planned operation.                          | Implemented |
| AC4 | SPA allows operators to record execution times/resources with basic validations.      | Implemented |

---

### 1.4. Dependencies

| Dependency                               | Description                                                                 |
|------------------------------------------|-----------------------------------------------------------------------------|
| OEM service (NestJS)                     | Owns planned/executed operation persistence and validation                   |
| TodoApi `OemProxyController`             | Proxies `/api/oem/vessel-visit-executions/*` calls to OEM                     |
| IAM / Auth cookies/JWT                   | Required by TodoApi `[Authorize]`                                            |
| Operation Plans (US 4.1.2–4.1.4)         | Planned operations originate from an Operation Plan associated to a VVE      |

---

### 1.5. Input and Output Data

**Input (SPA → API):**
- `PUT /api/oem/vessel-visit-executions/{id}/executed-operations/{plannedOperationId}` body:
  - `actualStartTime` *(ISO string, optional)*
  - `actualEndTime` *(ISO string, optional)*
  - `resourcesUsed` *(object, optional)* – arbitrary key/value structure

**Output (API → SPA):**
- `ExecutedOperationDto`
  - `plannedOperationId` *(number)*
  - `actualStartTime` *(ISO string, nullable)*
  - `actualEndTime` *(ISO string, nullable)*
  - `resourcesUsed` *(object, nullable)*
  - `executionStatus` *(enum)* – `PLANNED | STARTED | COMPLETED | DELAYED`

---

### 1.6. Main Endpoints

| Method | Endpoint                                                                 | Description                                             | Example |
|-------:|---------------------------------------------------------------------------|---------------------------------------------------------|---------|
| GET    | /api/oem/vessel-visit-executions/{id}/planned-operations                  | List planned operations for the execution               | `/api/oem/vessel-visit-executions/10/planned-operations` |
| GET    | /api/oem/vessel-visit-executions/{id}/executed-operations                 | List recorded executed operations for the execution     | `/api/oem/vessel-visit-executions/10/executed-operations` |
| PUT    | /api/oem/vessel-visit-executions/{id}/executed-operations/{plannedOperationId} | Upsert execution data for a planned operation           | `/api/oem/vessel-visit-executions/10/executed-operations/77` |

---

### 1.7. Example Requests (Postman)
```
# Planned ops for an execution
GET /api/oem/vessel-visit-executions/10/planned-operations

# Executed ops already recorded
GET /api/oem/vessel-visit-executions/10/executed-operations

# Upsert execution info for planned operation 77
PUT /api/oem/vessel-visit-executions/10/executed-operations/77
Content-Type: application/json
{
  "actualStartTime": "2025-05-06T09:00:00Z",
  "actualEndTime": "2025-05-06T10:10:00Z",
  "resourcesUsed": {
    "craneId": "CR-07",
    "staffIds": ["ST-220", "ST-337"],
    "notes": "Minor delay due to weather"
  }
}
```

---

### 1.8. Bootstrap Data (Seeding)
- This feature depends on VVEs having an associated Operation Plan.
- OEM contains dev-only helpers (not exposed via the TodoApi proxy) to associate an existing VVE with a compatible plan during development.

---

### 1.9. System Architecture (Summary)
- **Frontend:** Angular components `VesselVisitExecutionDetailComponent` and the execution-history operations drawer build per-operation payloads and call `OemApiService.upsertExecutedOperation`.
- **Gateway:** TodoApi `OemProxyController` forwards the `/api/oem/vessel-visit-executions/{id}/...` requests to OEM.
- **OEM service:** NestJS `VesselVisitExecutionController` coordinates the read of planned ops and the persistence of execution data.

---

### 1.10. Remarks
- When an execution has no plan, the UI shows an explicit "no plan associated" message instead of failing silently.
- The ARQSI PlantUML files currently under `Docs/Sprint C/arqsi/US 4.1.11` are mislabeled and should be corrected/replaced if they are meant to document this functionality.
