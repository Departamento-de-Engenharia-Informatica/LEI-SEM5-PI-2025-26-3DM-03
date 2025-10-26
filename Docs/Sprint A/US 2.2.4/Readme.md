# US 2.2.4 – Manage Storage Areas

## 1. Requirements Engineering

### 1.1. User Story Description
As a Port Authority Officer, I want to register and update storage areas, so that (un)loading and storage operations can be assigned to the correct locations.

---

### 1.2. Customer Specifications and Clarifications

From the specification document:

Each storage area must have a unique identifier, type (e.g., yard, warehouse), and location within the port.

Storage areas must specify maximum capacity (in TEUs) and current occupancy.

By default, a storage area serves the entire port (i.e., all docks). However, some storage areas (namely yards) may be constrained to serve only a few docks, usually the closest ones.

Complementary information, such as the distance between docks and storage areas, must be manually recorded to support future logistics planning and optimization.

Updates to storage areas must not allow the current occupancy to exceed maximum capacity.

---

### 1.3. Acceptance Criteria

| ID | Acceptance Criterion | Status |
|----|----------------------|--------|
| AC1 | Each storage area must have unique identifier, type, location, maximum capacity (TEUs), and current occupancy (TEUs). | Implemented |
| AC2 | Storage areas must enforce the business rule: current occupancy cannot exceed maximum capacity. | Implemented |
| AC3 | By default, storage areas serve all docks; optionally, they can be constrained to specific docks. | Implemented |
| AC4 | The system must validate that served dock IDs reference existing docks. | Implemented |
| AC5 | Distances between docks and storage areas must be recorded for logistics planning. | Implemented |
| AC6 | Storage areas must be searchable and filterable by type, location, and served dock. | Implemented |
| AC7 | The system must allow the creation, update, retrieval, and deletion of storage areas (CRUD). | Implemented |

---

### 1.4. Dependencies

| Dependency | Description |
|-------------|--------------|
| US 2.2.3 – Manage Docks | Storage areas depend on Docks for served dock validation and distance mapping. |
| Database Context (PortContext) | Required for persistence of storage area entities. |
| Entity Framework Core | Used for data access and JSON value converters for collections. |

---

### 1.5. Input and Output Data

**Input Data:**
- Type (string) - e.g., "Yard", "Warehouse"
- Location (string) - Location within the port
- MaxCapacityTEU (integer) - Maximum capacity in TEUs
- CurrentOccupancyTEU (integer) - Current occupancy in TEUs
- ServedDockIds (list of integers) - Optional list of dock IDs served (empty = all docks)
- DockDistances (dictionary) - Map of dock ID to distance in meters

**Output Data:**
- StorageAreaDTO object (includes served docks and distances)
- Confirmation message (on create/update/delete)
- Filtered list of StorageAreaDTOs (on search)

---

### 1.6. Main Endpoints

| Method | Endpoint | Description | Example |
|--------|-----------|--------------|----------|
| GET | /api/StorageAreas | Get all storage areas or search by query | `/api/StorageAreas?type=Yard&location=North` |
| GET | /api/StorageAreas/{id} | Get a specific storage area by id | `/api/StorageAreas/1` |
| POST | /api/StorageAreas | Create a new storage area | JSON body with all attributes |
| PUT | /api/StorageAreas/{id} | Update an existing storage area | JSON body with updated data |
| DELETE | /api/StorageAreas/{id} | Delete an existing storage area | No body required |

---

### 1.7. Example Requests (Postman)

```
GET /api/StorageAreas
GET /api/StorageAreas?type=Warehouse
GET /api/StorageAreas?location=North
GET /api/StorageAreas?servedDockId=2
GET /api/StorageAreas/1
POST /api/StorageAreas
PUT /api/StorageAreas/1
DELETE /api/StorageAreas/1
```

---

### 1.8. Bootstrap Data (Seeding)
Initial storage areas are seeded automatically through PortContext using EF Core's InMemory database, for example with initial records such as:
- "Yard-North" – Type: Yard – Location: North Terminal – Capacity: 500 TEUs – Occupancy: 120 TEUs
- "Warehouse-Central" – Type: Warehouse – Location: Central Area – Capacity: 300 TEUs – Occupancy: 80 TEUs

---

### 1.9. System Architecture (Summary)

- **Framework:** ASP.NET Core 8.0  
- **Persistence:** Entity Framework Core (InMemory) with JSON Value Converters  
- **Presentation:** REST API  
- **Clients:** Postman / Swagger  
- **Layers:** Controller → DTO → Mapper → Model → DbContext

---

### 1.10. Remarks
- The business rule "current occupancy ≤ maximum capacity" is enforced during create and update operations.
- Served dock IDs are validated against existing docks in the database.
- Dock distances are stored as a dictionary (JSON) mapping dock ID to distance in meters.
- Search filters are case-insensitive for type and location.
- Empty ServedDockIds means the storage area serves all docks in the port.
- Errors are mapped to `400 BadRequest` (validation) and `404 NotFound` (entity not found).

---
