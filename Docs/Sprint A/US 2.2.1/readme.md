# US 2.2.1 – Manage Vessel Types

## 1. Requirements Engineering

### 1.1. User Story Description
As a Port Authority Officer, I want to create and update vessel types, so that vessels can be classified consistently and their operational constraints are properly defined.

---

### 1.2. Customer Specifications and Clarifications

From the specification document:

Vessel types define the operational characteristics of vessels.  
These include attributes such as name, description, capacity, and operational constraints (maximum number of rows, bays, and tiers).

Vessel types must be available for reference when registering vessel records.

It should be possible to search and filter vessel types by name or description.



### 1.3. Acceptance Criteria

| ID | Acceptance Criterion | Status |
|----|----------------------|--------|
| AC1 | Vessel types must include attributes: name, description, capacity, maxRows, maxBays, maxTiers. | Implemented |
| AC2 | The system must allow the creation, update, retrieval, and deletion of vessel types (CRUD). | Implemented |
| AC3 | Vessel types must be available for reference by other entities (e.g., Vessel Records). | Implemented |
| AC4 | The user must be able to search vessel types by name and/or description. | Implemented |
| AC5 | The search must be case-insensitive. | Implemented |

---

### 1.4. Dependencies

| Dependency | Description |
|-------------|--------------|
| US 2.2.2 – Manage Vessels | Depends on Vessel Types being created beforehand. |
| Database Context (PortContext) | Required for persistence of vessel type entities. |
| Entity Framework Core | Used for data access and InMemory persistence during development. |

---

### 1.5. Input and Output Data

**Input Data:**
- Name (string)
- Description (string)
- Capacity (integer)
- MaxRows (integer)
- MaxBays (integer)
- MaxTiers (integer)

**Output Data:**
- VesselTypeDTO object
- Confirmation message (on create/update/delete)
- Filtered list of VesselTypeDTOs (on search)

---

### 1.6. Main Endpoints

| Method | Endpoint | Description | Example |
|--------|-----------|--------------|----------|
| GET | /api/VesselTypes | Get all vessel types or search by query | `/api/VesselTypes?search=container` |
| GET | /api/VesselTypes/{id} | Get a specific vessel type by id | `/api/VesselTypes/1` |
| POST | /api/VesselTypes | Create a new vessel type | JSON body with all attributes |
| PUT | /api/VesselTypes/{id} | Update an existing vessel type | JSON body with updated data |
| DELETE | /api/VesselTypes/{id} | Delete an existing vessel type | No body required |

---

### 1.7. Example Requests (Postman)

```
GET /api/VesselTypes?search=container
GET /api/VesselTypes/1
POST /api/VesselTypes
PUT /api/VesselTypes/1
DELETE /api/VesselTypes/1
```

---

### 1.8. Bootstrap Data (Seeding)
Initial vessel types are seeded automatically through PortContext using EF Core’s InMemory database, for example with initial records such as "Container Ship" and "Tanker".

---

### 1.9. System Architecture (Summary)

- **Framework:** ASP.NET Core 8.0  
- **Persistence:** Entity Framework Core (InMemory)  
- **Presentation:** REST API  
- **Clients:** Postman / Swagger  
- **Layers:** Controller → DTO → Mapper → Model → DbContext

---

### 1.10. Remarks

- The search functionality is implemented in a case-insensitive manner.  
- The solution currently uses an in-memory database but can easily be extended to a persistent one (SQL Server or PostgreSQL).  
- The VesselType entity is designed to evolve into a richer aggregate with Value Objects in future iterations.
