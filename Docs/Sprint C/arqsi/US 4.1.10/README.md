#  US 4.1.10 – Search & Manage Vessel Visit Executions

## 1. Requirements Engineering

### 1.1. User Story Description
As a Logistics Operator, I want to search and manage Vessel Visit Executions (VVEs) so that I can monitor ongoing/completed executions and keep real timestamps (arrival/berth/unberth/departure) and dock allocation up to date.

---

### 1.2. Customer Specifications and Clarifications
- The SPA provides a dedicated "Visit Executions" screen that lists VVEs with filters and pagination.
- Filters supported by the UI (debounced): `from`, `to`, `vesselVisitId`, `vesselName`, `status`.
- The list is retrieved through the TodoApi gateway (`/api/oem/vessel-visit-executions`) which proxies to the OEM service.
- Creation of a VVE is done from the same screen using `POST /api/oem/vessel-visit-executions` with:
  - `vvnId` (required)
  - `actualArrivalTime` (required)
- The screen supports operational updates:
  - update berth time and dock via `PATCH /api/oem/vessel-visit-executions/{id}`
  - complete an execution via `PATCH /api/oem/vessel-visit-executions/{id}/complete`
- UI validation rules (client-side):
  - `vesselVisitId` must be numeric.
  - When updating berth time, date/time must be provided consistently (no partial date-only/time-only).
  - When completing an execution, `actualUnberthTime` and `actualPortDepartureTime` are required and validated for chronological order.
- The screen includes an audit/history view for executions via `GET /api/oem/vessel-visit-executions/{id}/audit`.

---

### 1.3. Acceptance Criteria

| ID  | Acceptance Criterion                                                                 | Status      |
|-----|---------------------------------------------------------------------------------------|-------------|
| AC1 | REST API supports listing VVEs with filters (date range, vessel identifiers, status). | Implemented |
| AC2 | SPA provides a searchable list of executions with basic pagination.                   | Implemented |
| AC3 | Operator can create and update key execution fields (arrival/berth/dock/complete).    | Implemented |
| AC4 | Operator can consult an audit trail for VVE changes.                                  | Implemented |

---

### 1.4. Dependencies

| Dependency                               | Description                                                                 |
|------------------------------------------|-----------------------------------------------------------------------------|
| OEM service (NestJS)                     | Owns the VVE domain and exposes `/oem/vessel-visit-executions` endpoints     |
| TodoApi `OemProxyController`             | Proxies `/api/oem/vessel-visit-executions*` calls to the OEM service         |
| IAM / Auth cookies/JWT                   | Required by TodoApi `[Authorize]` for `/api/oem/*`                           |
| VVNs (Vessel Visit Notifications)        | Source identifier used when creating a new execution (payload `vvnId`)       |
| Docks catalog                            | Used to populate dock options when updating berth/dock                       |

---

### 1.5. Input and Output Data

**Input (SPA → API):**
- Filters (query string):
  - `from` *(string, optional)* – ISO date or datetime string
  - `to` *(string, optional)* – ISO date or datetime string
  - `vesselVisitId` *(number, optional)*
  - `vesselName` *(string, optional)*
  - `status` *(string, optional)* – e.g. `scheduled | in-progress | completed`
- Create payload: `POST /api/oem/vessel-visit-executions`
  - `vvnId` *(number, required)*
  - `actualArrivalTime` *(ISO string, required)*
- Update payload: `PATCH /api/oem/vessel-visit-executions/{id}`
  - `actualBerthTime` *(ISO string, optional)*
  - `dockId` *(string, optional)*
- Complete payload: `PATCH /api/oem/vessel-visit-executions/{id}/complete`
  - `actualUnberthTime` *(ISO string, required)*
  - `actualPortDepartureTime` *(ISO string, required)*

**Output (API → SPA):**
- `VesselVisitExecutionListItem[]` entries including:
  - identifiers: `id`, `vesselVisitNotificationId`, `vesselVisitId`, `vesselName`
  - execution data: `status`, `berthId`, timestamps, delay/turnaround metrics
- Audit entries: `VesselVisitExecutionAuditEntry[]` with `changedAt`, `changedBy`, `action`, `before`, `after`.

---

### 1.6. Main Endpoints

| Method | Endpoint                                             | Description                                              | Example |
|-------:|-------------------------------------------------------|----------------------------------------------------------|---------|
| GET    | /api/oem/vessel-visit-executions                      | List VVEs with optional filters                          | `/api/oem/vessel-visit-executions?status=in-progress&from=2025-05-01&to=2025-05-07` |
| POST   | /api/oem/vessel-visit-executions                      | Create a new execution for a given VVN                   | `/api/oem/vessel-visit-executions` |
| PATCH  | /api/oem/vessel-visit-executions/{id}                 | Update berth time and/or dock                            | `/api/oem/vessel-visit-executions/10` |
| PATCH  | /api/oem/vessel-visit-executions/{id}/complete        | Mark execution completed with unberth/departure times    | `/api/oem/vessel-visit-executions/10/complete` |
| GET    | /api/oem/vessel-visit-executions/{id}/audit           | Retrieve audit trail entries for a VVE                   | `/api/oem/vessel-visit-executions/10/audit` |

---

### 1.7. Example Requests (Postman)
```
# List executions for a period
GET /api/oem/vessel-visit-executions?from=2025-05-01&to=2025-05-07&status=in-progress

# Create an execution
POST /api/oem/vessel-visit-executions
Content-Type: application/json
{
  "vvnId": 1201,
  "actualArrivalTime": "2025-05-06T07:30:00Z"
}

# Update berth time and dock
PATCH /api/oem/vessel-visit-executions/10
Content-Type: application/json
{
  "actualBerthTime": "2025-05-06T08:10:00Z",
  "dockId": "D3"
}

# Complete execution
PATCH /api/oem/vessel-visit-executions/10/complete
Content-Type: application/json
{
  "actualUnberthTime": "2025-05-06T17:00:00Z",
  "actualPortDepartureTime": "2025-05-06T17:20:00Z"
}

# Audit trail
GET /api/oem/vessel-visit-executions/10/audit
```

---

### 1.8. Bootstrap Data (Seeding)
- No mandatory seeding for this feature.
- For development/testing, OEM includes helper endpoints to associate a VVE with an Operation Plan so downstream execution-logging flows can be tested.

---

### 1.9. System Architecture (Summary)
- **Frontend:** Angular standalone component `VesselVisitExecutionsHistoryComponent` using `OemApiService`.
- **Gateway:** ASP.NET Core `OemProxyController` exposes `/api/oem/vessel-visit-executions*` and forwards authenticated calls to OEM.
- **OEM service:** NestJS `VesselVisitExecutionController` exposes `/oem/vessel-visit-executions*` and persists changes, producing audit entries.
- **Security:** TodoApi requires authentication for `/api/oem/*`. OEM endpoints enforce roles via Nest guards (except where explicitly marked as dev/test).

---

### 1.10. Remarks
- The ARQSI PlantUML files currently present under `Docs/Sprint C/arqsi/US 4.1.10` are mislabeled (titles refer to unrelated US 3.x) and should not be treated as the source of truth for this feature.
- UI triggers list refresh after successful operations to avoid stale state.
