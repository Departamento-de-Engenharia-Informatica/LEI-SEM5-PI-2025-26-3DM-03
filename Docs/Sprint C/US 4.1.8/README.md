#  US 4.1.8 – Update Vessel Visit Execution Details

## 1. Requirements Engineering

### 1.1. User Story Description
As a Logistics Operator, I want to update an in-progress Vessel Visit Execution (VVE) with the actual berth time and dock used, so that discrepancies from the planned dock assignment are recorded.

---

### 1.2. Customer Specifications and Clarifications
- Only VVEs in status `InProgress` can be edited; once the visit is completed the update flow is disabled.
- Operators supply an actual berth timestamp (UTC) and the dock identifier where the vessel actually berthed.
- If the selected dock differs from the VVN planned dock, the backend automatically adds a warning note which the SPA displays inline.
- Each update is captured with `updatedAt` and `updatedBy` fields to support audit trails; audit events are emitted for downstream consumers.
- The SPA surfaces the planned dock alongside the actual dock, highlighting discrepancies.
- REST API enforces optimistic concurrency using the VVE `version` (ETag) so concurrent updates are detected.
- Operators can optionally add free-form comments explaining the change; comments are appended to the VVE audit log.

---

### 1.3. Acceptance Criteria

| ID  | Acceptance Criterion                                                                                                        | Status        |
|-----|-----------------------------------------------------------------------------------------------------------------------------|---------------|
| AC1 | REST API supports updating berth time and actual dock ID for an in-progress VVE.                                             | Implemented   |
| AC2 | When actual dock differs from the planned dock, a warning note is automatically added to the VVE record.                    | Implemented   |
| AC3 | SPA presents planned vs actual dock information and displays warnings to the operator.                                      | Implemented   |
| AC4 | Updates are timestamped with `updatedAt` and `updatedBy` and persisted for auditability.                                     | Implemented   |
| AC5 | Concurrent updates are prevented via optimistic locking, providing meaningful feedback to the operator on conflicts.        | Implemented   |

---

### 1.4. Dependencies

| Dependency                               | Description                                                                              |
|------------------------------------------|------------------------------------------------------------------------------------------|
| OEM VVE Service                          | Hosts update endpoint, performs validation, and persists changes                         |
| TodoApi OemProxyController / OemClient   | Forwards update requests and attaches IAM identity headers                               |
| IAM / Identity Provider                  | Supplies operator identity for `updatedBy` and audit logs                                |
| VVN Repository                           | Provides planned dock information for comparison                                         |
| Audit Event Bus                          | Receives `VVE_UPDATED` events for downstream monitoring                                  |

---

### 1.5. Input and Output Data
**Input (SPA → API):**
- `PATCH /api/oem/vves/{vveId}`
  - Body: `{ "actualBerthAt": "2026-01-04T09:05:00Z", "actualDockId": "DCK-07", "comment": "Shifted due to congestion", "version": 3 }`

**Output (API → SPA):**
- `VesselVisitExecutionDto`
  - `vveId`, `vvnId`, `status`, `plannedDockId`, `actualDockId`, `plannedBerthAt`, `actualBerthAt`, `updatedBy`, `updatedAt`, `version`, `warnings[]`
- HTTP 409 when optimistic concurrency fails (mismatched version)
- HTTP 400 when the selected dock is invalid or VVE not in `InProgress`

---

### 1.6. Main Endpoints

| Method | Endpoint                            | Description                                                         | Example                                                      |
|-------:|--------------------------------------|---------------------------------------------------------------------|--------------------------------------------------------------|
| PATCH  | /api/oem/vves/{vveId}                | Updates berth time and dock of an in-progress VVE                   | `/api/oem/vves/VVE-PORT-2026-000987`                         |
| GET    | /api/oem/vves/{vveId}                | Retrieves latest VVE details (used by SPA after update)             | `/api/oem/vves/VVE-PORT-2026-000987`                         |
| GET    | /api/oem/vvns/{vvnId}                | Provides planned dock/time for comparison                           | `/api/oem/vvns/VVN-PORT-2026-000123`                         |
| GET    | /api/oem/docks                       | Supplies valid dock identifiers for the selection list              | `/api/oem/docks`                                            |

---

### 1.7. Example Requests (Postman)
```
# Update berth time and dock for active VVE
PATCH /api/oem/vves/VVE-PORT-2026-000987
Content-Type: application/json
{
  "actualBerthAt": "2026-01-04T09:05:00Z",
  "actualDockId": "DCK-07",
  "comment": "Shifted due to crane obstruction",
  "version": 3
}

# Fetch updated VVE details
GET /api/oem/vves/VVE-PORT-2026-000987
```

---

### 1.8. Bootstrap Data (Seeding)
- Provide VVE fixtures in `InProgress` status with planned dock metadata to validate update flow.
- Include dock catalog data ensuring SPA dropdowns operate offline in Cypress tests.
- Seed audit log entries to confirm change history formatting when rendered in the monitoring UI.

---

### 1.9. System Architecture (Summary)
- **Frontend:** `VveDetailsComponent` renders the update form, pre-filling planned values and calling `OemVveService.updateVve`. It handles optimistic locking errors by reloading the latest values.
- **Backend:** `OemProxyController.UpdateVve` forwards the request, enriching headers with user identity and version token, and normalises concurrency error messages.
- **OEM Service:** `VveController` delegates to `VveUpdateService`, which validates `InProgress` status, compares planned vs actual dock, appends warnings, persists changes, increments version, and publishes `VVE_UPDATED` events.
- **Security:** OAuth2/OIDC ensures only authorised operators may modify VVEs; update history includes `updatedBy` from the token subject.

---

### 1.10. Remarks
- SPA shows discrepancy warnings in both the update form and the VVE timeline to alert shift supervisors.
- All timestamps remain UTC; UI applies locale formatting but uses UTC when sending updates.
- Future improvement: support multi-field updates (e.g., actual departure) within same endpoint once validated.
- Audit events include delta details (previous vs new dock/time) for downstream analytics.
