#  US 4.1.13 – Manage Incidents

## 1. Requirements Engineering

### 1.1. User Story Description
As a Logistics Operator, I want to register, update, search, and resolve incidents affecting vessel visit operations, so that operational disruptions are tracked with severity, scope, and time windows.

---

### 1.2. Customer Specifications and Clarifications
- The SPA provides an "Incidents" page with:
  - list/search with filters
  - create incident
  - edit incident
  - resolve incident (sets end time)
  - delete incident
- Incidents are categorized by an Incident Type (`incidentTypeId`) and include:
  - severity: `MINOR | MAJOR | CRITICAL`
  - scope: `ALL_ONGOING | SPECIFIC | UPCOMING`
  - time data: `startTime`, optional `endTime`
- Scope rules enforced in the UI:
  - `UPCOMING` requires `impactFrom` and `impactTo`.
  - `SPECIFIC` requires at least one affected VVE (`affectedVveIds`).
- The list endpoint supports filtering by vessel identifier and time range.
- Managing the list of affected VVEs is available for `SPECIFIC` incidents via dedicated endpoints (`/affected-vves`).
- Calls are executed through the TodoApi proxy (`/api/oem/incidents*`).

---

### 1.3. Acceptance Criteria

| ID  | Acceptance Criterion                                                                 | Status      |
|-----|---------------------------------------------------------------------------------------|-------------|
| AC1 | API supports CRUD operations for incidents with severity, scope, and time windows.   | Implemented |
| AC2 | API supports filtering/searching incidents by vessel identifier, type, status, etc.  | Implemented |
| AC3 | API supports associating incidents to specific VVEs when scope is SPECIFIC.          | Implemented |
| AC4 | SPA provides screens to create/edit/resolve/delete incidents with validations.       | Implemented |

---

### 1.4. Dependencies

| Dependency                               | Description                                                                 |
|------------------------------------------|-----------------------------------------------------------------------------|
| OEM service (NestJS)                     | Owns incident persistence and business rules                                 |
| TodoApi `OemProxyController`             | Proxies `/api/oem/incidents*` calls to OEM                                   |
| IAM / Auth cookies/JWT                   | Required by TodoApi `[Authorize]`                                            |
| Incident Types (US 4.1.12)               | Incidents reference types by `incidentTypeId`                                |
| Vessel Visit Executions (US 4.1.10)      | Incidents may reference VVEs when scope is `SPECIFIC`                        |

---

### 1.5. Input and Output Data

**Input (SPA → API):**
- Filters: `GET /api/oem/incidents` query
  - `vesselIdentifier` *(string, optional)*
  - `from` *(string, optional)*
  - `to` *(string, optional)*
  - `severity` *(enum, optional)* – `MINOR | MAJOR | CRITICAL`
  - `status` *(enum, optional)* – `ACTIVE | RESOLVED`
  - `incidentTypeId` *(number, optional)*
  - `scope` *(enum, optional)* – `ALL_ONGOING | SPECIFIC | UPCOMING`
- Create: `POST /api/oem/incidents`
  - `incidentTypeId` *(number, required)*
  - `severity` *(enum, required)*
  - `startTime` *(ISO string, required)*
  - `endTime` *(ISO string, optional/nullable)*
  - `description` *(string, optional/nullable)*
  - `scope` *(enum, required)*
  - `impactFrom` / `impactTo` *(ISO string, optional/nullable; required for UPCOMING)*
  - `affectedVveIds` *(number[], optional; required for SPECIFIC)*
- Update: `PATCH /api/oem/incidents/{id}`
  - partial update with same fields as create (all optional)
- Affected VVEs management (SPECIFIC scope):
  - replace set: `POST /api/oem/incidents/{id}/affected-vves` with `{ "vveIds": number[] }`
  - add one: `POST /api/oem/incidents/{id}/affected-vves/{vveId}`
  - remove one: `DELETE /api/oem/incidents/{id}/affected-vves/{vveId}`

**Output (API → SPA):**
- `IncidentDTO` entries including:
  - identifiers: `id`, `identifier`
  - classification: `incidentTypeId`, optional `incidentType` summary, `severity`
  - timing: `startTime`, `endTime`, `impactFrom`, `impactTo`
  - scope/status: `scope`, `status`, `affectedVveIds` (optional)
  - metadata: `createdBy`, `createdAt`, `updatedAt`

---

### 1.6. Main Endpoints

| Method | Endpoint                                     | Description                                        | Example |
|-------:|----------------------------------------------|----------------------------------------------------|---------|
| GET    | /api/oem/incidents                            | List incidents with optional filters               | `/api/oem/incidents?status=ACTIVE&severity=MAJOR` |
| POST   | /api/oem/incidents                            | Create incident                                    | `/api/oem/incidents` |
| PATCH  | /api/oem/incidents/{id}                       | Update incident                                    | `/api/oem/incidents/12` |
| DELETE | /api/oem/incidents/{id}                       | Delete incident                                    | `/api/oem/incidents/12` |
| POST   | /api/oem/incidents/{id}/affected-vves         | Replace affected VVEs list (SPECIFIC incidents)    | `/api/oem/incidents/12/affected-vves` |
| POST   | /api/oem/incidents/{id}/affected-vves/{vveId} | Attach a single affected VVE                       | `/api/oem/incidents/12/affected-vves/10` |
| DELETE | /api/oem/incidents/{id}/affected-vves/{vveId} | Detach a single affected VVE                       | `/api/oem/incidents/12/affected-vves/10` |

---

### 1.7. Example Requests (Postman)
```
# List incidents in a time window
GET /api/oem/incidents?from=2025-05-01T00:00:00Z&to=2025-05-07T23:59:59Z

# Create UPCOMING incident
POST /api/oem/incidents
Content-Type: application/json
{
  "incidentTypeId": 3,
  "severity": "MAJOR",
  "startTime": "2025-05-06T07:00:00Z",
  "description": "Storm forecast impacting port operations",
  "scope": "UPCOMING",
  "impactFrom": "2025-05-06T12:00:00Z",
  "impactTo": "2025-05-06T18:00:00Z"
}

# Create SPECIFIC incident affecting VVEs
POST /api/oem/incidents
Content-Type: application/json
{
  "incidentTypeId": 2,
  "severity": "CRITICAL",
  "startTime": "2025-05-06T09:15:00Z",
  "description": "Crane breakdown",
  "scope": "SPECIFIC",
  "affectedVveIds": [10, 11]
}

# Resolve an incident (set endTime)
PATCH /api/oem/incidents/12
Content-Type: application/json
{
  "endTime": "2025-05-06T15:30:00Z"
}

# Replace affected VVEs
POST /api/oem/incidents/12/affected-vves
Content-Type: application/json
{
  "vveIds": [10, 13]
}
```

---

### 1.8. Bootstrap Data (Seeding)
- No mandatory seeding. For demos, incident types should exist (can be created via the UI), then incidents can be created/filtered.

---

### 1.9. System Architecture (Summary)
- **Frontend:** Angular `IncidentsComponent` uses `OemApiService` and `IncidentTypesService` to load reference data (types + VVEs) and perform CRUD.
- **Gateway:** TodoApi `OemProxyController` proxies `/api/oem/incidents*`.
- **OEM service:** NestJS `IncidentController` applies scope semantics and persists incidents and their affected VVE relations.

---

### 1.10. Remarks
- The UI distinguishes between updating incident fields (`PATCH /incidents/{id}`) and managing affected VVEs (`/affected-vves`) for SPECIFIC scope.
- The ARQSI PlantUML files under `Docs/Sprint C/arqsi/US 4.1.13` are mislabeled and should be corrected if they are meant to describe this feature.
