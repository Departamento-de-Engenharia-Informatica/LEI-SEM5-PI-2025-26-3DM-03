#  US 4.1.5 – Detect Missing Operation Plans

## 1. Requirements Engineering

### 1.1. User Story Description
As a Logistics Operator, I want to identify Vessel Visit Notifications (VVNs) that do not yet have an Operation Plan, so that missing plans can be easily detected and generated.

---

### 1.2. Customer Specifications and Clarifications
- OEM exposes `/api/oem/operation-plans/missing?date=YYYY-MM-DD` returning VVNs scheduled for the specified day without a stored Operation Plan.
- Optional filters allow future expansion (e.g., vessel name, dock). Current implementation focuses on the day selector used in the SPA.
- The Angular SPA adds a "VVNs sem Plano" tab where missing VVNs are listed with vessel name, dock, ETA/ETD, cargo figures, and current status.
- Operators can select a scheduling algorithm and confirm regeneration of all plans for the chosen day using `/api/oem/operation-plans/regenerate-missing`.
- Regeneration response returns persisted plans, including metadata (`createdAt`, `createdBy`, `algorithmUsed`) which the SPA surfaces in notifications.
- Before triggering regeneration, the UI displays an explicit overwrite warning; confirmation toggles `confirmOverwrite` in the request payload.
- If the day still has conflicts (e.g., locked plans), the backend returns warnings to help the operator resolve outstanding issues.

---

### 1.3. Acceptance Criteria

| ID  | Acceptance Criterion                                                                                                          | Status        |
|-----|-------------------------------------------------------------------------------------------------------------------------------|---------------|
| AC1 | REST API provides an endpoint that returns VVNs lacking an Operation Plan.                                                    | Implemented   |
| AC2 | SPA shows the missing VVNs in a dedicated "Missing Plans" section/tab with key details.                                      | Implemented   |
| AC3 | Operators can trigger regeneration of all plans for the selected day with a chosen algorithm.                                 | Implemented   |
| AC4 | Regenerated plans capture metadata such as creation date, author, and algorithm used.                                         | Implemented   |
| AC5 | The system warns operators that regeneration overwrites existing plans for that day and requires explicit confirmation.       | Implemented   |

---

### 1.4. Dependencies

| Dependency                               | Description                                                                      |
|------------------------------------------|----------------------------------------------------------------------------------|
| OEM Planning Service                     | Supplies `/missing` and `/regenerate-missing` endpoints and persists plans       |
| TodoApi OemProxyController / OemClient   | Forwards SPA calls to OEM, applying IAM identity headers                         |
| IAM / Identity Provider                  | Ensures only authorised operators access regeneration capabilities               |
| Scheduling Algorithms                    | Reused from generation flow (single-crane, multi-crane, etc.)                    |
| Frontend Notification / Dialog services  | Deliver overwrite warnings and success messages                                  |

---

### 1.5. Input and Output Data
**Input (SPA → API):**
- `GET /api/oem/operation-plans/missing?date=YYYY-MM-DD`
- `POST /api/oem/operation-plans/regenerate-missing`
  - Body: `{ "date": "YYYY-MM-DD", "algorithm": "single-crane", "confirmOverwrite": true }`

**Output (API → SPA):**
- Missing list: `MissingOperationPlanDto[]`
  - `id`, `vesselName`, `dockId`, `eta`, `etd`, `containers`, `status`.
- Regeneration: `OperationPlanDto[]` with metadata (`createdAt`, `createdBy`, `algorithmUsed`, `targetDay`) and tasks.
- Warnings: optional `warnings[]` array signaling conflicts or skipped VVNs.

---

### 1.6. Main Endpoints

| Method | Endpoint                                          | Description                                                      | Example                                                                          |
|-------:|----------------------------------------------------|------------------------------------------------------------------|----------------------------------------------------------------------------------|
| GET    | /api/oem/operation-plans/missing                   | Returns VVNs without plans for the specified date.               | `/api/oem/operation-plans/missing?date=2025-11-23`                               |
| POST   | /api/oem/operation-plans/regenerate-missing        | Regenerates plans for all missing VVNs on the given date.        | `/api/oem/operation-plans/regenerate-missing`                                   |
| POST   | /api/oem/operation-plans/generate                  | Used internally after confirmation to persist generated plans.   | `/api/oem/operation-plans/generate`                                             |
| GET    | /api/oem/operation-plans?from=YYYY-MM-DD&to=...    | Refresh saved list after regeneration to show new metadata.      | `/api/oem/operation-plans?from=2025-11-23&to=2025-11-23`                         |

---

### 1.7. Example Requests (Postman)
```
# List missing VVNs for 23 Nov 2025
GET /api/oem/operation-plans/missing?date=2025-11-23

# Regenerate plans for missing VVNs (confirm overwrite)
POST /api/oem/operation-plans/regenerate-missing
Content-Type: application/json
{
  "date": "2025-11-23",
  "algorithm": "single-crane",
  "confirmOverwrite": true
}

# Refresh saved plans after regeneration
GET /api/oem/operation-plans?from=2025-11-23&to=2025-11-23
```

---

### 1.8. Bootstrap Data (Seeding)
- Test fixtures include VVNs deliberately left without plans to validate missing-plan workflows.
- Sample regeneration responses provide consistent metadata for Cypress assertions.

---

### 1.9. System Architecture (Summary)
- **Frontend:** `OemOperationPlansComponent` hosts the missing plans panel, using `OemApiService.getMissingOperationPlans` and `regenerateMissingOperationPlans`. Confirmation dialog enforces overwrite acknowledgement.
- **Backend:** `OemProxyController.GetMissingOperationPlans` & `RegenerateMissingOperationPlans` forward requests to OEM, handling warnings and status codes.
- **OEM Service:** Queries VVNs lacking linked plans, runs scheduling algorithm, persists new plans with metadata, returns warnings for conflicts.
- **Security:** IAM tokens required; regeneration endpoint gated by RBAC/ABAC ensuring only logistics operators/admins can invoke it.

---

### 1.10. Remarks
- Regeneration disables the action button while in progress and displays warnings inline upon completion.
- To prevent accidental overwrites, default state requires the operator to check "Confirm overwrite" before enabling the API call.
- Future improvement: allow selective regeneration for individual VVNs, keeping current bulk workflow as default.
- All timestamps remain UTC to align with scheduling algorithms and auditing.
