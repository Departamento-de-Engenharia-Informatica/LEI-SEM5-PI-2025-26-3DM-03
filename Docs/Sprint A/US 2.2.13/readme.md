# US 2.2.13 – Manage Qualifications

## 1. Requirements Engineering

### 1.1. User Story Description
As a **Port Authority Officer**, I want to create, update and manage qualifications for staff and resources, so that assignments and required competencies are enforced correctly.

---

### 1.2. Customer Specifications and Clarifications

Qualifications represent **certifications, competencies, or licenses** required to operate specific resources or to assign staff to particular tasks.  
Each qualification has:
- a **unique code** that identifies it,
- and a **description** explaining what it certifies.

The system must allow the creation, update, and retrieval of qualifications (CRUD, excluding deletion), and make them accessible to other aggregates such as **Resource** and **StaffMember** for validation and assignment.

Search and listing capabilities must be provided (filter by code or description).  
Duplicate codes must be rejected during creation.

---

### 1.3. Acceptance Criteria

| ID | Acceptance Criterion | Status |
|----|----------------------|--------|
| AC1 | Qualification must include attributes: `code`, `description`. | ✅ Implemented |
| AC2 | The system must allow creation, update, and retrieval of qualifications. | ✅ Implemented |
| AC3 | Qualifications must be referenceable by other entities (Resource, StaffMember). |  Pending (depends on other US) |
| AC4 | The user must be able to search qualifications by code and/or description. | ✅ Implemented |
| AC5 | The API must validate duplicate codes on creation. | ✅ Implemented |
| AC6 | Deletion of qualifications is not available in the current sprint. | ✅ Confirmed |

---

### 1.4. Dependencies

| Dependency | Description |
|-------------|-------------|
| **PortContext (DbContext)** | Manages persistence of `Qualification` entities and seeds initial data. |
| **Entity Framework Core** | Used for data access and InMemory persistence during development. |
| **US 2.2.11 – Manage Staff Members** | Staff will later reference qualifications for competency validation. |

---

### 1.5. Input and Output Data

**Input Data:**
- `code` (string, unique, primary key)
- `description` (string)

**Output Data:**
- `QualificationDTO` object  
- Confirmation message (on creation/update)  
- Filtered list of `QualificationDTO` (on search or listing)

---

### 1.6. Main Endpoints

| Method | Endpoint | Description | Example |
|--------|-----------|-------------|----------|
| GET | `/api/Qualifications` | Get all qualifications or search by query | `/api/Qualifications?search=truck` |
| GET | `/api/Qualifications/{code}` | Get a specific qualification by its code | `/api/Qualifications/STS_OP` |
| POST | `/api/Qualifications` | Create a new qualification | JSON body with code and description |
| PUT | `/api/Qualifications/{code}` | Update an existing qualification’s description | JSON body with updated data |

> ❗ **DELETE** endpoint not implemented in this sprint.

---

### 1.7. Example Requests (Postman)

#### ➤ GET all qualifications
```
GET https://localhost:7167/api/Qualifications
```

#### ➤ GET qualification by code
```
GET https://localhost:7167/api/Qualifications/STS_OP
```

#### ➤ POST new qualification
```
POST https://localhost:7167/api/Qualifications
Content-Type: application/json

{
  "code": "MECH_OP",
  "description": "Mechanical Operator"
}
```

#### ➤ PUT update qualification description
```
PUT https://localhost:7167/api/Qualifications/MECH_OP
Content-Type: application/json

{
  "description": "Updated description for Mechanical Operator"
}
```

---

### 1.8. Bootstrap Data (Seeding)

Initial qualifications are automatically seeded in `PortContext` (InMemory database):

| Code | Description |
|------|--------------|
| STS_OP | STS Crane Operator |
| TRUCK_DRV | Truck Driver |

---

### 1.9. System Architecture (Summary)

- **Framework:** ASP.NET Core 8.0  
- **Persistence:** Entity Framework Core (InMemory)  
- **Presentation:** REST API  
- **Clients:** Postman / Swagger  
- **Layers:** Controller → DTO → Mapper → Model → DbContext  

---

### 1.10. Remarks

- `Code` serves as the **primary key** for the `Qualification` entity.  
- Duplicate codes are **rejected** during creation (`POST`).  
- Case-insensitive filtering is supported for both `code` and `description`.  
- Deletion will be implemented later once dependent entities (Staff, Resources) reference qualifications.

---
