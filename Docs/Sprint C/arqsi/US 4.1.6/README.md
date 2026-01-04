#  US 4.1.6 – Query Resource Allocation Totals

## 1. Requirements Engineering

### 1.1. User Story Description
As a Logistics Operator, I want to query, for a given period, the total allocation time of a specific resource (e.g., crane, dock, or staff), so that I can assess resource utilization and workload distribution.

---

### 1.2. Customer Specifications and Clarifications
- The SPA offers a dedicated "Utilização de Recursos" view where operators choose resource type, identifier, and date range.
- The UI must only consider Operation Plans that are persisted with status `Saved`; drafts or simulations are ignored.
- Aggregations include total allocated minutes, number of distinct operations, first/last allocation timestamps, and average allocation per day.
- Operators can toggle between summary chart and tabular presentation; the base requirement focuses on the table.
- REST endpoints support resource kinds `crane`, `dock`, `yard-slot`, and `staff`. Additional types can be added without breaking changes by reusing the same query schema.
- Responses surface warning metadata when gaps exist (e.g., missing plan segments) so operators understand incomplete totals.
- Filters default to the current week; operators may extend the range up to 90 days.

---

### 1.3. Acceptance Criteria

| ID  | Acceptance Criterion                                                                                              | Status        |
|-----|-------------------------------------------------------------------------------------------------------------------|---------------|
| AC1 | REST API exposes aggregation endpoints returning resource usage totals within a given period.                    | Implemented   |
| AC2 | Response payload contains total allocated time (minutes) and number of operations per resource.                  | Implemented   |
| AC3 | SPA renders the aggregated results in a summary table with filters for resource and period.                      | Implemented   |
| AC4 | Aggregations exclude Operation Plans that are not yet saved/persisted.                                           | Implemented   |
| AC5 | System warns when aggregation is partial (e.g., missing plans in the selected period).                           | Implemented   |

---

### 1.4. Dependencies

| Dependency                               | Description                                                                 |
|------------------------------------------|-----------------------------------------------------------------------------|
| OEM Planning Service                     | Provides `/resource-usage` aggregation endpoints backed by Operation Plans |
| TodoApi OemProxyController / OemClient   | Relays SPA aggregation queries to OEM, propagating IAM headers              |
| IAM / Identity Provider                  | Guarantees only authorised operators can access resource metrics           |
| Operation Plan Repository                | Source of persisted plans filtered by status `Saved`                       |
| Frontend Table & Chart modules           | Render summary table and optional chart view                               |

---

### 1.5. Input and Output Data
**Input (SPA → API):**
- `GET /api/oem/resource-usage?resourceType=crane&resourceId=CRN-01&from=2025-11-01&to=2025-11-07`
- Optional flags: `groupBy=day|operation`, `includeWarnings=true`

**Output (API → SPA):**
- `ResourceUsageSummaryDto`
  - `resourceId`, `resourceType`, `from`, `to`
  - `totalAllocatedMinutes`
  - `operationsCount`
  - `averageMinutesPerOperation`
  - `firstAllocationAt`, `lastAllocationAt`
  - `warnings[]` (optional)
- `ResourceUsageBreakdownDto[]` (when grouped by day/operation)

---

### 1.6. Main Endpoints

| Method | Endpoint                                                    | Description                                                     | Example                                                                 |
|-------:|--------------------------------------------------------------|-----------------------------------------------------------------|-------------------------------------------------------------------------|
| GET    | /api/oem/resource-usage                                     | Returns aggregated totals for a resource in a period            | `/api/oem/resource-usage?resourceType=dock&resourceId=DCK-03&from=2025-11-01&to=2025-11-15` |
| GET    | /api/oem/resource-usage/breakdown                           | Returns grouped aggregation (per day/operation)                 | `/api/oem/resource-usage/breakdown?resourceType=staff&resourceId=STF-22&groupBy=day&from=2025-11-01&to=2025-11-07` |
| GET    | /api/oem/operation-plans?status=Saved&from=...&to=...       | Internal refresh endpoint ensuring SPA uses persisted plans     | `/api/oem/operation-plans?status=Saved&from=2025-11-01&to=2025-11-15` |

---

### 1.7. Example Requests (Postman)
```
# Aggregate crane CRN-01 for the first week of Nov 2025
GET /api/oem/resource-usage?resourceType=crane&resourceId=CRN-01&from=2025-11-01&to=2025-11-07

# Fetch daily breakdown for logistics staff STF-22
GET /api/oem/resource-usage/breakdown?resourceType=staff&resourceId=STF-22&groupBy=day&from=2025-11-01&to=2025-11-15

# Refresh persisted Operation Plans (used by SPA cache invalidation)
GET /api/oem/operation-plans?status=Saved&from=2025-11-01&to=2025-11-15
```

---

### 1.8. Bootstrap Data (Seeding)
- Seed plans for cranes, docks, and staff covering typical allocation patterns, ensuring status `Saved` to be included in queries.
- Include at least one resource with zero allocations to validate empty-state handling in the SPA.
- Provide fixture responses for Cypress tests covering aggregated totals and breakdown endpoints.

---

### 1.9. System Architecture (Summary)
- **Frontend:** `ResourceUtilizationComponent` hosts filter form, consumes `OemResourceUsageService` to load summaries, and renders a table via shared grid component.
- **Backend:** `OemProxyController.GetResourceUsage` and `GetResourceUsageBreakdown` forward authenticated requests to the OEM platform, enforcing date-range validation and `Saved` status filters.
- **OEM Service:** `ResourceUsageController` delegates to `ResourceUsageService`, which aggregates persisted Operation Plan tasks, calculating totals and counts per resource.
- **Security:** Same IAM flow as other OEM operations; RBAC ensures only logistics operators see utilization metrics.

---

### 1.10. Remarks
- SPA highlights warnings (e.g., missing days) inline above the summary table to prompt further investigation.
- Aggregation uses UTC timestamps; UI applies locale formatting for display but sends UTC back to the API.
- Future enhancement: export aggregated data to CSV directly from the SPA.
- Rate limiting is applied to prevent excessive queries (max 30 requests per minute per operator session).
