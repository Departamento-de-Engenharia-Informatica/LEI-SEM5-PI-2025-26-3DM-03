#  US 4.1.12 – Manage Incident Types

## 1. Requirements Engineering

### 1.1. User Story Description
As a Logistics Operator, I want to manage Incident Types (including a parent/child hierarchy) so that incidents can be categorized consistently with a severity level and optionally grouped under parent categories.

---

### 1.2. Customer Specifications and Clarifications
- The SPA provides an "Incident Types" page with two views:
  - flat list view
  - hierarchical tree view
- Filtering supported by the UI and API:
  - free-text query `q`
  - `severity` (MINOR/MAJOR/CRITICAL)
  - `parentId`
  - `tree=true` to return hierarchy
- CRUD operations are supported:
  - create: code/name/severity (+ optional description/parent)
  - update: same fields
  - delete
- UI validation rules:
  - `code` and `name` are mandatory (trimmed)
  - parent selection does not allow self-reference
- Calls are made to the TodoApi proxy (`/api/oem/incident-types*`).

---

### 1.3. Acceptance Criteria

| ID  | Acceptance Criterion                                                                              | Status      |
|-----|----------------------------------------------------------------------------------------------------|-------------|
| AC1 | API supports listing incident types with filters and optional hierarchy output.                    | Implemented |
| AC2 | API supports CRUD operations for incident types.                                                   | Implemented |
| AC3 | SPA provides a management UI with flat and tree visualization and filter controls.                | Implemented |

---

### 1.4. Dependencies

| Dependency                               | Description                                                                 |
|------------------------------------------|-----------------------------------------------------------------------------|
| OEM service (NestJS)                     | Owns IncidentType persistence and hierarchy logic                            |
| TodoApi `OemProxyController`             | Proxies `/api/oem/incident-types*` calls to OEM                              |
| IAM / Auth cookies/JWT                   | Required by TodoApi `[Authorize]`                                            |
| Incidents feature (US 4.1.13)            | Incidents reference incident types by `incidentTypeId`                       |

---

### 1.5. Input and Output Data

**Input (SPA → API):**
- `GET /api/oem/incident-types` query:
  - `parentId` *(number, optional)*
  - `severity` *(enum, optional)* – `MINOR | MAJOR | CRITICAL`
  - `q` *(string, optional)*
  - `tree` *(boolean, optional)*
- `POST /api/oem/incident-types` body:
  - `code` *(string, required)*
  - `name` *(string, required)*
  - `severity` *(enum, required)*
  - `description` *(string, optional)*
  - `parentId` *(number|null, optional)*

**Output (API → SPA):**
- Flat list response: `IncidentTypeDTO[]`
  - `id`, `code`, `name`, `description?`, `severity`, `parentId?`, `createdAt`, `updatedAt?`
- Tree response: `IncidentTypeTreeDTO[]` (same fields + optional `children[]`)

---

### 1.6. Main Endpoints

| Method | Endpoint                         | Description                                          | Example |
|-------:|-----------------------------------|------------------------------------------------------|---------|
| GET    | /api/oem/incident-types           | List incident types (flat)                           | `/api/oem/incident-types?q=weather&severity=MAJOR` |
| GET    | /api/oem/incident-types?tree=true | List incident types as a hierarchy/tree              | `/api/oem/incident-types?tree=true` |
| POST   | /api/oem/incident-types           | Create a new incident type                           | `/api/oem/incident-types` |
| PATCH  | /api/oem/incident-types/{id}      | Update an existing incident type                     | `/api/oem/incident-types/5` |
| DELETE | /api/oem/incident-types/{id}      | Delete an incident type                              | `/api/oem/incident-types/5` |

---

### 1.7. Example Requests (Postman)
```
# Flat list with filters
GET /api/oem/incident-types?q=delay&severity=MINOR

# Tree
GET /api/oem/incident-types?tree=true

# Create
POST /api/oem/incident-types
Content-Type: application/json
{
  "code": "INC001",
  "name": "Weather issue",
  "severity": "MAJOR",
  "description": "Wind / rain impacting operations",
  "parentId": null
}

# Update
PATCH /api/oem/incident-types/5
Content-Type: application/json
{
  "name": "Weather constraints",
  "severity": "MAJOR"
}

# Delete
DELETE /api/oem/incident-types/5
```

---

### 1.8. Bootstrap Data (Seeding)
- No mandatory seeding. For demo/testing, incident type entries can be created through the UI.

---

### 1.9. System Architecture (Summary)
- **Frontend:** Angular `IncidentTypesComponent` uses `IncidentTypesService` (with fallback between gateway and direct OEM when running locally).
- **Gateway:** TodoApi `OemProxyController` exposes the `/api/oem/incident-types*` routes.
- **OEM service:** NestJS `IncidentTypeController` handles filtering and (when `tree=true`) returns a hierarchical DTO.

---

### 1.10. Remarks
- In the OEM service controller, authentication guards are currently commented out, while the TodoApi proxy remains protected via `[Authorize]`. If OEM is exposed directly, guards should be re-enabled.
- The ARQSI PlantUML files under `Docs/Sprint C/arqsi/US 4.1.12` are mislabeled and should be corrected if they are meant to represent this feature.
