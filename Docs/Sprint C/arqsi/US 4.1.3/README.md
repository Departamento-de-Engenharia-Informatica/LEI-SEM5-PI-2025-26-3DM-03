#  US 4.1.3 – Search Operation Plans

## 1. Requirements Engineering

### 1.1. User Story Description
As a Logistics Operator, I want to search and list Operation Plans for a given day or period, so that I can quickly review all scheduled activities within that timeframe.

---

### 1.2. Customer Specifications and Clarifications
- The SPA exposes a saved plans section with filters for **from/to** dates and optional **vessel visit identifier**. Flatpickr date range picker feeds ISO strings to the API.
- REST endpoint `/api/oem/operation-plans` accepts `from`, `to`, and `vesselVisitId` query parameters. Filters may be combined; blank values are ignored.
- Returned plans include summary data: vessel name, dock, planned start/end, algorithm, status, responsible operator, and resource assignments (tasks collection).
- Table supports sorting by name, VVN, planned start, and creation timestamp; pagination keeps six rows per page by default.
- Empty-state and error banners help operators understand when filters yield no results or when backend calls fail.
- Operators can open plan details from the listing to inspect full timeline, resources, and change history without leaving the page.
- Saved search results refresh automatically after plan updates to reflect the newest data and maintain consistency.

---

### 1.3. Acceptance Criteria

| ID  | Acceptance Criterion                                                                                 | Status        |
|-----|-------------------------------------------------------------------------------------------------------|---------------|
| AC1 | REST API supports querying Operation Plans by date range and/or vessel identifier.                    | Implemented   |
| AC2 | SPA provides a searchable, filterable table with plan summaries (vessel, dock, timings, resources).   | Implemented   |
| AC3 | Results can be sorted (e.g., by start time, vessel name, expected delay/creation date).               | Implemented   |

---

### 1.4. Dependencies

| Dependency                               | Description                                                                |
|------------------------------------------|----------------------------------------------------------------------------|
| OEM Planning Service                     | Stores plans and supports filtering endpoints consumed by TodoApi proxy   |
| TodoApi OemProxyController / OemClient   | Proxies SPA queries to OEM, applying identity headers                     |
| IAM / Identity Provider                  | Ensures authenticated access respecting RBAC/ABAC policies                |
| Frontend Shared Components               | Flatpickr integration, pagination, table sorting utilities                |

---

### 1.5. Input and Output Data
**Input (SPA → API):**
- `GET /api/oem/operation-plans?from=YYYY-MM-DD&to=YYYY-MM-DD&vesselVisitId=123`

**Output (API → SPA):**
- `OperationPlanDto[]`
  - `id`, `name`, `vesselVisitId`, `dockId`, `plannedStartTime`, `plannedEndTime`, `targetDay`, `status`, `algorithmUsed`, `createdAt`, `createdBy`, `tasks[]`, `changeLogs[]`.
- Errors mapped to `ProblemDetails` style JSON (`status`, `message`, `errors`).

---

### 1.6. Main Endpoints

| Method | Endpoint                              | Description                                               | Example                                                                     |
|-------:|----------------------------------------|-----------------------------------------------------------|-----------------------------------------------------------------------------|
| GET    | /api/oem/operation-plans               | List plans with optional `from`, `to`, `vesselVisitId`.   | `/api/oem/operation-plans?from=2025-11-23&to=2025-11-24`                    |
| GET    | /api/oem/operation-plans/{id}          | Fetch plan details for drill-down modal.                  | `/api/oem/operation-plans/42`                                               |
| GET    | /api/oem/operation-plans/{id}?includeTasks=true | Load tasks and change logs shown in detail drawer. | `/api/oem/operation-plans/42?includeTasks=true`                              |

---

### 1.7. Example Requests (Postman)
```
# Fetch plans for a single day
GET /api/oem/operation-plans?from=2025-11-23&to=2025-11-23

# Fetch plans for a week and filter by VVN identifier
GET /api/oem/operation-plans?from=2025-11-20&to=2025-11-27&vesselVisitId=1205

# Retrieve specific plan with full details
GET /api/oem/operation-plans/102?includeTasks=true
```

---

### 1.8. Bootstrap Data (Seeding)
- Demo data includes multiple plans across different days, docks, and VVNs to exercise filters.
- Sample response fixtures underpin Cypress E2E tests covering search, sorting, and detail drilling.

---

### 1.9. System Architecture (Summary)
- **Frontend:** Angular `OemOperationPlansComponent` hosts search form, table, sort/pagination state, and detail modal. Reactive forms integrate with flatpickr for date ranges.
- **Backend:** `OemProxyController.GetOperationPlans` builds query string and forwards to OEM via `OemClient.GetOperationPlansAsync`.
- **OEM Service:** Accepts query parameters, executes filtered database query, returns summaries enriched with metadata.
- **Security:** Cookies/JWT validated upstream; TodoApi attaches identity headers before calling OEM.

---

### 1.10. Remarks
- Sorting currently occurs client-side after retrieval; dataset volume is manageable. Future enhancement could push sorting to OEM for scalability.
- Table remembers page index when filters update to improve UX.
- Detail drawer reuses update payload builder to ensure consistent formatting when editing from search results.
- Network errors display actionable messages and prompt manual retry without losing filter state.
