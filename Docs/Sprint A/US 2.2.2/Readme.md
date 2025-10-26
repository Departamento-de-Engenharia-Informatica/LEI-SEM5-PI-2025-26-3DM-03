# US 2.2.2 – Manage Vessels

## 1. Requirements Engineering

### 1.1. User Story Description
As a Port Authority Officer, I want to register and update vessel records, so that valid vessels can be referenced in visit notifications.

---

### 1.2. Customer Specifications and Clarifications

From the specification document:

Each vessel record must include key attributes such as IMO number, vessel name, vessel type and operator/owner.

The system must validate that the IMO number follows the official format (seven digits with a check digit), otherwise reject it.

Vessel records must be searchable by IMO number, name, or operator.

Vessels must reference an existing Vessel Type to ensure data consistency.

---

### 1.3. Acceptance Criteria

| ID | Acceptance Criterion | Status |
|----|----------------------|--------|
| AC1 | Each vessel record must include IMO number (7 digits with check digit), name, vessel type, and operator/owner. | Implemented |
| AC2 | The system must validate that the IMO number follows the official format (7 digits with check digit). | Implemented |
| AC3 | Invalid IMO numbers must be rejected by the system. | Implemented |
| AC4 | Vessels must reference an existing Vessel Type. | Implemented |
| AC5 | Vessel records must be searchable by IMO number, name, or operator (case-insensitive). | Implemented |
| AC6 | The system must allow the creation, update, retrieval, and deletion of vessel records (CRUD). | Implemented |

---

### 1.4. Dependencies

| Dependency | Description |
|-------------|--------------|
| US 2.2.1 – Manage Vessel Types | Vessels depend on Vessel Types being created beforehand. |
| Database Context (PortContext) | Required for persistence of vessel entities. |
| Entity Framework Core | Used for data access and InMemory persistence during development. |

---

### 1.5. Input and Output Data

**Input Data:**
- Imo (string) - 7 digits with check digit validation
- Name (string)
- VesselTypeId (integer) - Must reference an existing Vessel Type
- Operator (string)

**Output Data:**
- VesselDTO object (includes VesselTypeDTO when loaded)
- Confirmation message (on create/update/delete)
- Filtered list of VesselDTOs (on search)

---

### 1.6. Main Endpoints

| Method | Endpoint | Description | Example |
|--------|-----------|--------------|----------|
| GET | /api/Vessels | Get all vessels or search by query | `/api/Vessels?operator=ShippingCo` |
| GET | /api/Vessels/{imo} | Get a specific vessel by IMO | `/api/Vessels/1234567` |
| POST | /api/Vessels | Create a new vessel | JSON body with all attributes |
| PUT | /api/Vessels/{imo} | Update an existing vessel | JSON body with updated data |
| DELETE | /api/Vessels/{imo} | Delete an existing vessel | No body required |

---

### 1.7. Example Requests (Postman)
```
GET /api/Vessels
GET /api/Vessels?imo=123
GET /api/Vessels?name=atlantic
GET /api/Vessels?operator=shipping
GET /api/Vessels/1234567
POST /api/Vessels
PUT /api/Vessels/1234567
DELETE /api/Vessels/1234567
```

---

### 1.8. Bootstrap Data (Seeding)
Initial vessels are seeded automatically through PortContext using EF Core's InMemory database, for example with initial records such as:
- "MV Example One" – IMO 1234567 – VesselTypeId=1
- "MT Sample Tanker" – IMO 7654321 – VesselTypeId=2

---

### 1.9. System Architecture (Summary)
- **Framework:** ASP.NET Core 8.0  
- **Persistence:** Entity Framework Core (InMemory)  
- **Presentation:** REST API  
- **Clients:** Postman / Swagger  
- **Layers:** Controller → DTO → Mapper → Model → DbContext

---

### 1.10. Remarks
- IMO validation is implemented in `VesselMapper.IsValidImo` following the official IMO check digit algorithm.
- Search filters are case-insensitive for name and operator.
- Errors are mapped to `400 BadRequest` (validation) and `404 NotFound` (entity not found).
- Vessels must reference an existing VesselType; invalid VesselTypeId will be rejected.

---
