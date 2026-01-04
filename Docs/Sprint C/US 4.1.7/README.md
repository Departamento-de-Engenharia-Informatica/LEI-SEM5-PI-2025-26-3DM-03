#  US 4.1.7 – Register Vessel Visit Execution

## 1. Requirements Engineering

### 1.1. User Story Description
As a Logistics Operator, I want to create a Vessel Visit Execution (VVE) record when a vessel arrives at the port, so that the actual start of operations can be logged and monitored.

---

### 1.2. Customer Specifications and Clarifications
- VVEs are always linked to an existing Vessel Visit Notification (VVN); the UI pre-fills context from the selected VVN.
- Operators enter the actual arrival timestamp (UTC) and may adjust it before saving; once submitted the timestamp is immutable.
- The system generates a VVE identifier following the same pattern as VVN codes (e.g., `VVE-PORT-2026-000123`).
- The SPA displays a confirmation modal summarising vessel name, quay, and planned arrival to minimise data entry errors.
- Backend defaults the new VVE status to `InProgress` and records the creator user ID based on the IAM token subject.
- Creation triggers an audit event so other systems can track the moment operations begin.
- Only VVN records with status `Scheduled` or `Ready` can spawn a VVE; the UI grays out others.
- When a VVE exists for a VVN, the SPA highlights that visit as "In progress" and disables duplicate submissions.

---

### 1.3. Acceptance Criteria

| ID  | Acceptance Criterion                                                                                                  | Status        |
|-----|-----------------------------------------------------------------------------------------------------------------------|---------------|
| AC1 | REST API exposes an endpoint to create a VVE that references an existing VVN.                                         | Implemented   |
| AC2 | Stored VVE contains VVN reference, vessel identifier, actual arrival time, creator user ID, and generated VVE ID.     | Implemented   |
| AC3 | SPA assists operators by pre-filling VVE creation data using the selected VVN information.                            | Implemented   |
| AC4 | Newly created VVE must have status `In Progress`.                                                                     | Implemented   |
| AC5 | Duplicate VVE creation for the same VVN is prevented and flagged to the operator.                                     | Implemented   |

---

### 1.4. Dependencies

| Dependency                               | Description                                                                      |
|------------------------------------------|----------------------------------------------------------------------------------|
| VVN Repository                            | Supplies vessel visit context and enforces valid statuses                        |
| OEM Planning Service                     | Hosts the VVE creation REST endpoint and persists execution data                 |
| TodoApi OemProxyController / OemClient   | Forwards SPA requests and attaches IAM identity headers                          |
| IAM / Identity Provider                  | Provides operator identity for audit and creator user ID                         |
| Audit Event Bus                          | Receives VVE-created events for downstream systems                               |

---

### 1.5. Input and Output Data
**Input (SPA → API):**
- `POST /api/oem/vvns/{vvnId}/vves`
  - Body: `{ "actualArrivalAt": "2026-01-04T08:45:00Z" }`

**Output (API → SPA):**
- `VesselVisitExecutionDto`
  - `vveId`, `vvnId`, `vesselId`, `actualArrivalAt`, `status`, `createdBy`, `createdAt`
  - `warnings[]` (optional, e.g., when arrival deviates significantly from plan)
- HTTP 409 when a VVE already exists for the VVN

---

### 1.6. Main Endpoints

| Method | Endpoint                                   | Description                                                   | Example                                                   |
|-------:|---------------------------------------------|---------------------------------------------------------------|-----------------------------------------------------------|
| POST   | /api/oem/vvns/{vvnId}/vves                  | Creates a VVE for the specified VVN                           | `/api/oem/vvns/VVN-PORT-2026-000123/vves`                 |
| GET    | /api/oem/vvns/{vvnId}/vves/current          | Returns the active VVE for the VVN (if any)                   | `/api/oem/vvns/VVN-PORT-2026-000123/vves/current`         |
| GET    | /api/oem/vvns?status=Scheduled              | Used by SPA to list eligible VVNs                             | `/api/oem/vvns?status=Scheduled`                          |
| GET    | /api/oem/vves/{vveId}                       | Fetches VVE details for monitoring dashboards                | `/api/oem/vves/VVE-PORT-2026-000987`                     |

---

### 1.7. Example Requests (Postman)
```
# Create a VVE for a scheduled visit
POST /api/oem/vvns/VVN-PORT-2026-000123/vves
Content-Type: application/json
{
  "actualArrivalAt": "2026-01-04T08:45:00Z"
}

# Fetch the active VVE for a visit
GET /api/oem/vvns/VVN-PORT-2026-000123/vves/current

# Retrieve VVE details by ID
GET /api/oem/vves/VVE-PORT-2026-000987
```

---

### 1.8. Bootstrap Data (Seeding)
- Seed VVNs with status `Scheduled` to supply the selection list in the SPA.
- Populate sample VVE records to test duplicate prevention and monitoring dashboards.
- Audit fixtures ensure event consumers can replay `VVE_CREATED` messages during integration tests.

---

### 1.9. System Architecture (Summary)
- **Frontend:** `VesselVisitExecutionComponent` guides operators through selecting a VVN, confirms arrival time, and invokes `OemVveService.createVve`. The component shows existing VVEs to prevent duplicates.
- **Backend:** `OemProxyController.CreateVve` validates the VVN ID, forwards the request with the operator identity, and translates OEM error codes (e.g., duplicates, invalid status).
- **OEM Service:** `VveController` uses `VveApplicationService` to verify VVN eligibility, generate the VVE identifier, persist execution data, and emit an audit event.
- **Security:** OAuth2/OIDC tokens ensure only authorised logistics operators may create VVEs; creator user ID is derived from the token subject claim.

---

### 1.10. Remarks
- SPA highlights the recorded arrival time and offers quick navigation to the monitoring dashboard once the VVE is created.
- Future enhancement: allow adjusting arrival details via a dedicated edit flow with audit tracking.
- All timestamps are UTC; any deviation from planned arrival beyond tolerance produces a warning badge in the UI.
