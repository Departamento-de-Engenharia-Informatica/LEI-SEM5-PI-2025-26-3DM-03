# US 2.2.12 – Manage Resources

## 1. Requirements Engineering

### 1.1. User Story Description
As a **Port Authority Officer**, I want to create, update and manage port resources (cranes, trucks, equipment), so that resource allocation and operational planning can be performed correctly.

---

### 1.2. Customer Specifications and Clarifications

Resources represent **physical equipment and facilities** available in the port for cargo operations.  
Each resource has:
- a **unique alphanumeric code** that identifies it,
- a **description** explaining the resource,
- a **type** (e.g., Fixed Crane, Mobile Crane, Truck, Forklift),
- an **operational capacity** (numeric value),
- an **assigned area** (optional location, e.g., "Dock A"),
- a **setup time** (optional time in minutes),
- a **status** (Active, Inactive, Under Maintenance),
- and **required qualifications** (list of qualification codes).

The system must allow the creation, update, and retrieval of resources (CRUD operations), and make them accessible for resource allocation and scheduling.

Search and listing capabilities must be provided.  
Duplicate codes must be rejected during creation.

---

### 1.3. Acceptance Criteria

| ID | Acceptance Criterion | Status |
|----|----------------------|--------|
| AC1 | Resource must include attributes: `code`, `description`, `type`, `operationalCapacity`, `status`, `assignedArea`, `setupTimeMinutes`, `requiredQualifications`. | ✅ Implemented |
| AC2 | The system must allow creation, update, and retrieval of resources. | ✅ Implemented |
| AC3 | Resources can be deactivated, reactivated, or set under maintenance. | ✅ Implemented |
| AC4 | The user must be able to list all resources. | ✅ Implemented |
| AC5 | The API must validate duplicate codes on creation. | ✅ Implemented |
| AC6 | Resource code must be alphanumeric. | ✅ Implemented |

---

### 1.4. Dependencies

| Dependency | Description |
|-------------|-------------|
| **PortContext (DbContext)** | Manages persistence of `Resource` entities and seeds initial data. |
| **Entity Framework Core** | Used for data access and InMemory persistence during development. |
| **US 2.2.13 – Manage Qualifications** | Resources reference qualifications for operator requirements. |

---

### 1.5. Input and Output Data

**Input Data (Create):**
- `code` (string, unique, alphanumeric)
- `description` (string)
- `type` (string, e.g., "FixedCrane", "Truck")
- `operationalCapacity` (decimal, must be positive)
- `assignedArea` (string, optional)
- `setupTimeMinutes` (integer, optional, must be non-negative)

**Input Data (Update):**
- `description` (string)
- `operationalCapacity` (decimal, must be positive)
- `assignedArea` (string, optional)
- `setupTimeMinutes` (integer, optional, must be non-negative)

**Output Data:**
- `ResourceDTO` object  
- Confirmation message (on creation/update)  
- List of `ResourceDTO` (on listing)

---

### 1.6. Main Endpoints

| Method | Endpoint | Description | Example |
|--------|-----------|-------------|----------|
| GET | `/api/Resources` | Get all resources | `/api/Resources` |
| GET | `/api/Resources/{code}` | Get a specific resource by its code | `/api/Resources/STS001` |
| POST | `/api/Resources` | Create a new resource | JSON body with resource data |
| PUT | `/api/Resources/{code}` | Update an existing resource | JSON body with updated data |
| PATCH | `/api/Resources/{code}/deactivate` | Deactivate a resource | `/api/Resources/STS001/deactivate` |

---

### 1.7. Example Requests (Postman)

#### ➤ GET all resources
```
GET https://localhost:7167/api/Resources
```

#### ➤ GET resource by code
```
GET https://localhost:7167/api/Resources/STS001
```

#### ➤ POST new resource
```
POST https://localhost:7167/api/Resources
Content-Type: application/json

{
  "code": "TRK002",
  "description": "Terminal Truck 2",
  "type": "Truck",
  "operationalCapacity": 30.0,
  "assignedArea": "Yard A",
  "setupTimeMinutes": 5
}
```

#### ➤ PUT update resource
```
PUT https://localhost:7167/api/Resources/TRK002
Content-Type: application/json

{
  "description": "Updated Terminal Truck 2",
  "operationalCapacity": 35.0,
  "assignedArea": "Yard B",
  "setupTimeMinutes": 10
}
```

#### ➤ PATCH deactivate resource
```
PATCH https://localhost:7167/api/Resources/TRK002/deactivate
```

---

### 1.8. Bootstrap Data (Seeding)

Initial resources are automatically seeded in `PortContext` (InMemory database):

| Code | Description | Type | Capacity | Area | Setup Time | Status |
|------|-------------|------|----------|------|------------|--------|
| STS001 | Ship-to-Shore Crane 1 | FixedCrane | 50.0 | North Pier 1 | 15 min | Active |
| TRK001 | Terminal Truck 1 | Truck | 30.0 | - | - | Active |

---

### 1.9. System Architecture (Summary)

- **Framework:** ASP.NET Core 8.0  
- **Persistence:** Entity Framework Core (InMemory)  
- **Presentation:** REST API  
- **Clients:** Postman / Swagger  
- **Layers:** Controller → Mapper → Model → DbContext  

---

### 1.10. Remarks

- `Code` serves as the **primary key** for the `Resource` entity.  
- Duplicate codes are **rejected** during creation (`POST`).  
- Resource code must be **alphanumeric** only.
- Resources can be in three states: **Active**, **Inactive**, or **Under Maintenance**.
- `RequiredQualifications` is stored as a comma-separated string in the database.

---
