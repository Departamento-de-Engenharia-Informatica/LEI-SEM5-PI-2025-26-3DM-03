#  US 4.1.9 – Record Executed Operations for VVE

## 1. Requirements Engineering

### 1.1. User Story Description
As a Logistics Operator, I want to update an in-progress Vessel Visit Execution (VVE) with executed operations, so that the system reflects real execution progress and performance.

---

### 1.2. Customer Specifications and Clarifications
- Execution updates are initiated from the in-progress VVE screen; planned operations are preloaded to ease data entry.
- Operators confirm or adjust actual start/end timestamps, resources used (cranes, docks, staff), and optionally add execution notes.
- Each executed operation is linked back to its planned operation, allowing status transitions (`Started`, `Completed`, `Delayed`).
- When timings deviate from the plan beyond defined thresholds, the backend generates warnings that the SPA surfaces inline.
- Update actions append `updatedAt`, `updatedBy`, and per-operation execution history entries for auditability.
- Completion states must synchronise with the corresponding Operation Plan so dashboards can compare planned vs actual progress.
- Bulk updates are supported: operators can confirm multiple operations at once, with partial failures returning per-operation feedback.
- IAM roles ensure only authorised logistics operators or supervisors can modify execution data.

---

### 1.3. Acceptance Criteria

| ID  | Acceptance Criterion                                                                                                            | Status        |
|-----|---------------------------------------------------------------------------------------------------------------------------------|---------------|
| AC1 | REST API allows updating executed operations for an in-progress VVE, referencing planned operation IDs.                         | Implemented   |
| AC2 | SPA lets operators confirm or adjust start/end timestamps and resource usage for each executed operation.                       | Implemented   |
| AC3 | Corresponding planned operations are marked as `Started`, `Completed`, or `Delayed` according to execution data.                | Implemented   |
| AC4 | Execution updates persist timestamps and operator identifiers for auditability.                                                 | Implemented   |
| AC5 | Operation Plan state synchronises with execution status, enabling planned vs actual comparison in downstream views.             | Implemented   |

---

### 1.4. Dependencies

| Dependency                               | Description                                                                                 |
|------------------------------------------|---------------------------------------------------------------------------------------------|
| OEM VVE Service                          | Provides execution update endpoint and manages VVE lifecycle                                |
| Operation Plan Service                   | Receives execution status updates for comparison dashboards                                 |
| TodoApi OemProxyController / OemClient   | Forwards SPA execution updates, propagating IAM headers                                     |
| IAM / Identity Provider                  | Identifies operators for audit logging and authorization                                    |
| Scheduling/Planning Repository           | Supplies planned operations data used to pre-fill execution forms                           |
| Audit Event Bus                          | Receives `VVE_OPERATION_UPDATED` events for analytics and compliance tracking               |

---

### 1.5. Input and Output Data
**Input (SPA → API):**
- `PATCH /api/oem/vves/{vveId}/operations`
  - Body:
    ```json
    {
      "operations": [
        {
          "plannedOperationId": "OP-123",
          "actualStartAt": "2026-01-04T09:15:00Z",
          "actualEndAt": "2026-01-04T10:05:00Z",
          "actualResources": {
            "craneId": "CRN-01",
            "dockId": "DCK-07",
            "staffIds": ["STF-22", "STF-48"]
          },
          "status": "Completed",
          "comment": "Completed with 10 min delay",
          "version": 2
        }
      ]
    }
    ```

**Output (API → SPA):**
- `ExecutedOperationDto[]`
  - `plannedOperationId`, `actualStartAt`, `actualEndAt`, `actualResources`, `status`, `updatedBy`, `updatedAt`, `version`, `warnings[]`
- Summary payload includes VVE progress percentage and plan-vs-actual deltas.

---

### 1.6. Main Endpoints

| Method | Endpoint                                      | Description                                                                 | Example                                                                     |
|-------:|------------------------------------------------|-----------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| PATCH  | /api/oem/vves/{vveId}/operations               | Updates execution details for planned operations within the VVE            | `/api/oem/vves/VVE-PORT-2026-000987/operations`                             |
| GET    | /api/oem/vves/{vveId}/operations               | Retrieves latest execution state for a VVE                                  | `/api/oem/vves/VVE-PORT-2026-000987/operations`                             |
| GET    | /api/oem/operation-plans/{planId}/operations   | Supplies planned operations for pre-filling execution data                  | `/api/oem/operation-plans/OPP-2026-001/operations`                          |
| POST   | /api/oem/operation-plans/{planId}/sync-status  | OEM internal endpoint to synchronise plan status with execution updates     | `/api/oem/operation-plans/OPP-2026-001/sync-status`                         |

---

### 1.7. Example Requests (Postman)
```
# Confirm execution for multiple operations
PATCH /api/oem/vves/VVE-PORT-2026-000987/operations
Content-Type: application/json
{
  "operations": [
    {
      "plannedOperationId": "OP-123",
      "actualStartAt": "2026-01-04T09:15:00Z",
      "actualEndAt": "2026-01-04T10:05:00Z",
      "actualResources": {
        "craneId": "CRN-01"
      },
      "status": "Completed",
      "comment": "Completed with 10 min delay",
      "version": 2
    },
    {
      "plannedOperationId": "OP-124",
      "actualStartAt": "2026-01-04T10:10:00Z",
      "status": "Started",
      "version": 1
    }
  ]
}

# Refresh execution state to show progress
GET /api/oem/vves/VVE-PORT-2026-000987/operations
```

---

### 1.8. Bootstrap Data (Seeding)
- Include planned operations with diverse resources to validate SPA pre-filling.
- Seed executed operations with varying statuses to test transitions and conflict handling.
- Provide audit log samples capturing partial updates and version increments for Cypress validation.

---

### 1.9. System Architecture (Summary)
- **Frontend:** `VveOperationsComponent` lists planned operations, lets operators confirm or adjust execution data, and calls `OemVveService.updateOperations`. Concurrency checks warn operators when another user updated the same operation.
- **Backend:** `OemProxyController.UpdateVveOperations` validates operator identity, ensures payload references valid planned operations, and forwards bulk updates to the OEM service while managing partial failure responses.
- **OEM Service:** `VveOperationsController` uses `VveExecutionService` to reconcile planned and executed data, update VVE aggregates, emit audit events, and invoke the Operation Plan synchronisation workflow.
- **Security:** OAuth2/OIDC tokens enforce operator permissions; each execution change records `updatedBy` and adheres to optimistic locking per operation.

---

### 1.10. Remarks
- SPA displays plan vs actual variance badges (duration, start delay) to highlight deviations.
- Execution updates propagate to performance dashboards in near real-time via audit events.
- Future enhancement: support media attachments (photos, documents) for operations requiring proof of performance.
- Resilience pattern: backend retries Operation Plan synchronisation when downstream service is temporarily unavailable.
