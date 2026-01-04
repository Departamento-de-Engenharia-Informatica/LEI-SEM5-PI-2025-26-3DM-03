#  US 4.1.4 – Update Operation Plans

## 1. Requirements Engineering

### 1.1. User Story Description
As a Logistics Operator, I want to manually update the Operation Plan of a given VVN, so that last-minute adjustments (e.g., resource or timing changes) can be made when needed.

---

### 1.2. Customer Specifications and Clarifications
- Only users with role **logistics-operator** (or **admin**) may edit saved Operation Plans in the SPA.
- The edit drawer loads the latest plan via `/api/oem/operation-plans/{id}` and exposes summary fields (status, dock, VVN identifiers, timestamps) plus the task list.
- Mandatory fields: `status` and `reason`. Each task requires `type`, `startTime`, `endTime`; optional links exist for `craneId`, `storageAreaId`, `staffIds`.
- Time inputs use `datetime-local` controls and are converted to ISO strings before calling the API.
- Available cranes, docks, storage areas, and staff members are preloaded through dedicated services so the operator can match real resources.
- The backend expects partial updates through `PATCH /api/oem/operation-plans/{id}` with `{ reason, status?, dockId?, tasks? }`.
- Change logging is handled on the OEM side: responses include `plan`, optional `logEntry`, and `warnings`. The SPA surfaces warnings in the edit sheet and appends them to the change history timeline.
- Inconsistency detection (e.g., overlapping cranes/staff, conflicting VVNs) is delivered as warning strings; the operator can cross-check allocation in `/api/oem/operation-plans/resource-allocation` when needed.

---

### 1.3. Acceptance Criteria

| ID  | Acceptance Criterion                                                                                                    | Status        |
|-----|--------------------------------------------------------------------------------------------------------------------------|---------------|
| AC1 | Provide REST endpoints that allow updating an existing Operation Plan for a VVN.                                         | Implemented   |
| AC2 | SPA must let the operator edit key plan attributes (status, dock, crane assignments, timings, staff per task).           | Implemented   |
| AC3 | Every update must require a reason and be recorded in the plan change log with author and timestamp.                     | Implemented   |
| AC4 | The system must highlight warnings if the edited plan conflicts with related VVNs or resource availability constraints. | Implemented   |

---

### 1.4. Dependencies

| Dependency                               | Description                                                                 |
|------------------------------------------|-----------------------------------------------------------------------------|
| OEM Operation Planning Service           | External service that stores plans and evaluates conflicts/inconsistencies |
| OemProxyController / OemClient           | Backend proxy layer that signs OEM calls with identity headers             |
| IAM / Identity Provider                  | Supplies JWT/cookies used by SPA and API to authenticate requests          |
| Docks, Resources, Storage Areas, Staff   | Catalog services providing reference data for assignment dropdowns         |
| Vessel Visit Notifications (VVNs)        | Source data identifying which plan is being updated                        |

---

### 1.5. Input and Output Data
**Input (SPA → API):**
- `PATCH /api/oem/operation-plans/{id}` body:
  - `reason` *(string, required)* – motivation for the change (shown in logs).
  - `status` *(string, optional)* – `draft | planned | in-progress | completed | cancelled`.
  - `dockId` *(string, optional)* – physical dock assigned to the plan.
  - `tasks` *(array, optional)* – list of operations to execute.
    - `tasks[n].id` *(number, optional)* – existing task identifier.
    - `tasks[n].type` *(string, required)* – operation type (load, unload, reposition, etc.).
    - `tasks[n].craneId` *(string, optional)* – assigned crane resource.
    - `tasks[n].storageAreaId` *(string, optional)* – storage area reference.
    - `tasks[n].staffIds` *(array<string>, optional)* – supporting staff IDs.
    - `tasks[n].startTime` *(ISO string, required)* – scheduled start.
    - `tasks[n].endTime` *(ISO string, required)* – scheduled end.

**Output (API → SPA):**
- `OperationPlanUpdateResponse`
  - `plan` *(OperationPlanDto)* – updated plan snapshot including tasks and metadata.
  - `warnings` *(string[])* – detected inconsistencies/resource conflicts, if any.
  - `logEntry` *(OperationPlanChangeLogDto, optional)* – new audit record with author, reason, timestamp, warnings, and field deltas.

---

### 1.6. Main Endpoints

| Method | Endpoint                                             | Description                                                     | Example                                                                 |
|-------:|-------------------------------------------------------|-----------------------------------------------------------------|-------------------------------------------------------------------------|
| GET    | /api/oem/operation-plans                              | Lists saved plans; filters by `from`, `to`, `vesselVisitId`.    | `/api/oem/operation-plans?vesselVisitId=1024`                          |
| GET    | /api/oem/operation-plans/{id}                         | Retrieves a single plan (optionally with `?includeTasks=true`). | `/api/oem/operation-plans/42?includeTasks=true`                        |
| PATCH  | /api/oem/operation-plans/{id}                         | Updates plan summary/tasks and records change log.              | `/api/oem/operation-plans/42`                                          |
| GET    | /api/oem/operation-plans/resource-allocation          | Summarises crane/dock/staff allocation for conflict analysis.   | `/api/oem/operation-plans/resource-allocation?from=2025-05-01&to=2025-05-07&resourceType=crane` |
| GET    | /api/oem/vessel-visit-executions?status=scheduled     | Lists executions to help operators cross-check related VVNs.    | `/api/oem/vessel-visit-executions?vesselVisitId=1024&status=in-progress` |

---

### 1.7. Example Requests (Postman)
```
# Load saved plans for a VVN
GET /api/oem/operation-plans?vesselVisitId=1024

# Fetch plan with tasks
GET /api/oem/operation-plans/42?includeTasks=true

# Update plan (status + dock + tasks)
PATCH /api/oem/operation-plans/42
Content-Type: application/json
{
  "reason": "Adjust crane due to breakdown",
  "status": "in-progress",
  "dockId": "D3",
  "tasks": [
    {
      "id": 10,
      "type": "load",
      "craneId": "CR-07",
      "storageAreaId": "SA-12",
      "staffIds": ["ST-991", "ST-204"],
      "startTime": "2025-05-06T08:00:00Z",
      "endTime": "2025-05-06T10:30:00Z"
    }
  ]
}

# Inspect resource allocation for crane CR-07
GET /api/oem/operation-plans/resource-allocation?from=2025-05-06&to=2025-05-06&resourceType=crane&resourceId=CR-07
```

---

### 1.8. Bootstrap Data (Seeding)
- No static seeding. Plans originate from OEM generation (`/preview` + `/generate`) or migrations of real VVN data.

---

### 1.9. System Architecture (Summary)
- **Frontend:** Angular SPA (`OemOperationPlansComponent`) with reactive forms, flatpickr date pickers, and service calls via `OemApiService`.
- **Backend:** ASP.NET Core controller `OemProxyController` proxies requests to `OemClient`, which signs OEM HTTP calls with session identity headers.
- **External OEM Service:** Owns the Operation Plan domain, evaluates conflicts, persists logs, and returns warning metadata.
- **Security:** Requests carry authentication cookies/JWT validated by the gateway; only authorised roles can reach edit endpoints.
- **Audit Trail:** OEM responses include `changeLogs` displayed in SPA history, reinforcing traceability for compliance.

---

### 1.10. Remarks
- The edit drawer enforces `reason` before saving and resets the form with the server response to avoid stale values.
- Warning banners appear immediately after `PATCH` responses; they are also persisted in the plan timeline so future viewers notice potential issues.
- Operators may launch the resource allocation dashboard from the side navigation to double-check crane/staff utilisation when warnings arise.
- All timestamps are handled in ISO 8601 UTC to simplify comparisons and avoid local-time drift when exporting data.
- Conflicting updates from concurrent sessions are mitigated by reloading the plan after each save and refetching the saved plans grid.
