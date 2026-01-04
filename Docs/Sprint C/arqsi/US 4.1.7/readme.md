# US 4.1.7 – Create Vessel Visit Execution (VVE)

## 1. Requirements Engineering

### 1.1. User Story Description
As a Logistics Operator, I want to create a Vessel Visit Execution (VVE) record when a vessel arrives at the port, so that the actual start of operations can be logged and monitored.

---

### 1.2. Customer Specifications and Clarifications

From the specification document:

A Vessel Visit Execution (VVE) represents the actual execution of a planned vessel visit (VVN) at the port.  
VVE records capture the actual arrival time and mark the beginning of port operations for the vessel.

Each VVE must reference an existing Vessel Visit Notification (VVN) to ensure proper planning alignment.

VVE records must include vessel identifier, actual arrival time, and creator user ID, with automatic VVE identifier generation.

The SPA must facilitate VVE creation using available VVN information for easy reference.


### 1.3. Acceptance Criteria

| ID | Acceptance Criterion | Status |
|----|----------------------|--------|
| AC1 | REST API must allow creating a new VVE referencing an existing VVN. | Implemented |
| AC2 | VVE must include: VVE identifier (auto-generated with VVN pattern), vessel identifier, actual arrival time, creator user ID. | Implemented |
| AC3 | SPA must facilitate VVE creation using available VVN information. | Implemented |
| AC4 | Once created, VVE must be marked as "In Progress". | Implemented |
| AC5 | VVE records must be retrievable and searchable by status. | Implemented |

---

### 1.4. Dependencies

| Dependency | Type | Description |
|------------|------|-------------|
| **US 4.1.1** – OEM Module Backend Service | **Blocking** | VVE creation must be part of the OEM module's REST API. This US depends on the OEM module being established as a modular, independent backend service with proper architectural patterns. |
| **US 4.1.2** – Operation Plans Generation | **Related** | VVE may reference an Operation Plan generated for the VVN. Future iterations may integrate VVE execution with operation plan tracking. |
| **US 4.1.8** – Update VVE (Berth Time) | **Sequential** | Follows VVE creation. Allows recording actual berth time and dock used. |
| **US 4.1.9** – Update VVE (Executed Operations) | **Sequential** | Follows VVE creation. Allows recording actual operation execution and progress. |
| **US 4.1.10** – Search and List VVEs | **Sequential** | Provides query capabilities for created VVEs over time periods or by vessel. |
| **US 4.1.11** – Mark VVE as Completed | **Sequential** | Final step in VVE lifecycle after all operations are recorded. |

---

### 1.5. Input and Output Data

**Input Data:**
- VVN ID (long) - reference to existing VVN
- Vessel Identifier (string)
- Actual Arrival Time (DateTime)
- Creator User ID (string) - captured from auth context

**Output Data:**
- VVEDTO object
- VVE Identifier (auto-generated, pattern: VVN-like)
- Status ("In Progress")
- Confirmation message (on creation)
- Retrieved VVE records (on search/get)

---

### 1.6. Main Endpoints

| Method | Endpoint | Description | Example |
|--------|-----------|--------------|----------|
| GET | /api/VesselVisitExecutions | Get all VVEs or search by status | `/api/VesselVisitExecutions?status=InProgress` |
| GET | /api/VesselVisitExecutions/{id} | Get a specific VVE by id | `/api/VesselVisitExecutions/1` |
| POST | /api/VesselVisitExecutions | Create a new VVE | JSON body with VVN ID, vessel identifier, arrival time |
| GET | /api/VesselVisitExecutions/status/{status} | Get VVEs by status | `/api/VesselVisitExecutions/status/InProgress` |

---

### 1.7. Example Requests (Postman)

```
GET /api/VesselVisitExecutions?status=InProgress
GET /api/VesselVisitExecutions/1
POST /api/VesselVisitExecutions
Content-Type: application/json
{
  "vvnId": 1,
  "vesselIdentifier": "SHIP-001",
  "actualArrivalTime": "2026-01-04T14:30:00Z"
}
GET /api/VesselVisitExecutions/status/InProgress
```

---

### 1.8. Bootstrap Data (Seeding)
Initial VVEs are optional during seeding. Typically, VVEs are created dynamically when vessels arrive. However, test data can be seeded through PortContext using EF Core's InMemory database.

---

### 1.9. System Architecture (Summary)

- **Framework:** ASP.NET Core 8.0  
- **Persistence:** Entity Framework Core (InMemory / SQL)  
- **Presentation:** REST API  
- **Clients:** Angular SPA / Postman / Swagger  
- **Layers:** Controller → Service → DTO → Mapper → Model → DbContext
- **Key Components:**
  - VVEController: Handles HTTP requests
  - VVEService: Business logic (VVN validation, VVE ID generation, status management)
  - VVEMapper: DTO ↔ Entity conversions
  - PortContext: Database context with DbSet<VesselVisitExecution>

---

### 1.10. Remarks

- VVE creation automatically generates a unique identifier following the VVN identifier pattern.
- The creator user ID is captured from the authenticated user context (IAM).
- VVE status is automatically set to "In Progress" upon creation.
- VVN validation ensures referential integrity (foreign key constraint).
- The solution uses an in-memory database during development but can be extended to SQL Server or PostgreSQL.
- Future iterations may include VVE completion, status transitions, and event logging for port operations tracking.
