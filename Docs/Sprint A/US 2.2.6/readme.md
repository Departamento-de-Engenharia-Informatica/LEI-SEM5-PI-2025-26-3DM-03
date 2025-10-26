# US 2.2.6 – Manage Representatives of a Shipping Agent

## 1. Requirements Engineering

### 1.1. User Story Description

As a **Port Authority Officer**,  
I want to **register and manage representatives** of a shipping agent organization (**create, update, deactivate**),  
so that the right individuals are authorized to interact with the system on behalf of their organization.

---

### 1.2. Customer Specifications and Clarifications

From the specification document:

- All operations are **scoped to an existing organization** identified by its **tax number**.
- Each representative must include:
  - **name**, **citizen ID**, **nationality**, **email**, and **phone number**.
- Representatives can be **deactivated** (they remain linked to the organization but cannot act).
- **Exactly one organization per representative**:
  - A representative belongs to **one** shipping agent organization at a time (association enforced by API scoping: `/api/ShippingAgents/{taxNumber}/Representatives`).
- (Recommended) **citizenID should be unique within the same organization** to avoid duplicates.

Additional clarifications:

- Email/SMS notifications may be sent on create/update/deactivate (optional).
- Authentication/authorization uses JWT Bearer; only authorized officers can perform these operations.

---

### 1.3. Acceptance Criteria

| ID | Acceptance Criterion | Status |
|----|----------------------|--------|
| AC1 | Create a representative for a given `taxNumber` with required fields. | Implemented |
| AC2 | Update a representative’s details for a given `taxNumber` and `id`. | Implemented |
| AC3 | Deactivate a representative (`isActive = false`). | Implemented |
| AC4 | Validate required fields on create/update (name, citizenID, nationality, email, phoneNumber). | Implemented |
| AC5 | Return **404 Not Found** when the organization (`taxNumber`) or representative (`id`) does not exist. | Implemented |
| AC6 | (Recommended) Reject duplicate **citizenID** within the same organization (return **400 Bad Request**). | Implemented (if enabled in service) |
| AC7 | All endpoints require authentication (JWT bearer); invalid/absent token → **401/403**. | Implemented |

---

### 1.4. Dependencies

| Dependency | Description |
|-------------|--------------|
| **IShippingAgentRepository** | Loads shipping agent aggregates (with representatives) and persists changes. |
| **PortContext (EF Core)** | Persistence for ShippingAgents and Representatives. |
| **RepresentativeMapper** | Maps DTOs ↔ domain models for representatives. |
| **Notification Service** | (Optional) Sends notifications on changes. |
| **External IAM Provider** | OAuth 2.0 / OIDC token issuance validated by ASP.NET Auth middleware. |

---

### 1.5. Input and Output Data

**CreateRepresentativeDTO / UpdateRepresentativeDTO (input):**

- `name: string`  
- `citizenID: string`  
- `nationality: string`  
- `email: string`  
- `phoneNumber: string`

**RepresentativeDTO (output):**

- `id: int`  
- `name: string`  
- `citizenID: string`  
- `nationality: string`  
- `email: string`  
- `phoneNumber: string`  
- `isActive: bool`

**Notes:**
- Create returns **201 Created** with body `RepresentativeDTO` and a `Location` header to `GET /api/ShippingAgents/{taxNumber}/Representatives/{id}`.
- Update returns **200 OK** with updated `RepresentativeDTO`.
- Deactivate returns **204 No Content**.

---

### 1.6. Main Endpoints

| Method | Endpoint | Description | Success | Errors |
|---|---|---|---|---|
| **GET** | `/api/ShippingAgents/{taxNumber}/Representatives` | List representatives for an organization | **200 OK** | 404 (org not found), 401/403 |
| **GET** | `/api/ShippingAgents/{taxNumber}/Representatives/{id}` | Get representative by id | **200 OK** | 404, 401/403 |
| **POST** | `/api/ShippingAgents/{taxNumber}/Representatives` | **Create** a representative | **201 Created** (+ Location) | 400 (validation/duplicate), 404 (org), 401/403 |
| **PUT** | `/api/ShippingAgents/{taxNumber}/Representatives/{id}` | **Update** representative | **200 OK** | 400 (validation/duplicate), 404 (org/rep), 401/403 |
| **POST** | `/api/ShippingAgents/{taxNumber}/Representatives/{id}/deactivate` | **Deactivate** representative | **204 No Content** | 404 (org/rep), 401/403 |
| **DELETE** | `/api/ShippingAgents/{taxNumber}/Representatives/{id}` | Delete representative | **204 No Content** | 404 (org/rep), 401/403 |

---

### 1.7. Example Requests (Postman)

**Create**
```
POST /api/ShippingAgents/123456789/Representatives

{
  "name": "Maria Costa",
  "citizenID": "CID-8765",
  "nationality": "Portuguese",
  "email": "maria.costa@atlantic.com",
  "phoneNumber": "+351911112222"
}

{
  "id": 2,
  "name": "Maria Costa",
  "citizenID": "CID-8765",
  "nationality": "Portuguese",
  "email": "maria.costa@atlantic.com",
  "phoneNumber": "+351911112222",
  "isActive": true
}

PUT /api/ShippingAgents/123456789/Representatives/2

{
  "name": "Maria C. Costa",
  "citizenID": "CID-8765",
  "nationality": "Spanish",
  "email": "maria.costa@atlantic.com",
  "phoneNumber": "+351930000000"
}

POST /api/ShippingAgents/123456789/Representatives/2/deactivate

204 No Content

GET /api/ShippingAgents/123456789/Representatives

[
  {
    "id": 1,
    "name": "João Silva",
    "citizenID": "12345678",
    "nationality": "Portuguese",
    "email": "joao.silva@atlantic.com",
    "phoneNumber": "+351912345678",
    "isActive": true
  },
  {
    "id": 2,
    "name": "Maria C. Costa",
    "citizenID": "CID-8765",
    "nationality": "Spanish",
    "email": "maria.costa@atlantic.com",
    "phoneNumber": "+351930000000",
    "isActive": false
  }
]
```

### 1.8. Bootstrap Data (Seeding)

For demos/tests you may seed representatives within seeded organizations in PortContext (e.g., one active, one deactivated).

### 1.9. System Architecture (Summary)

Framework: ASP.NET Core 8.0

Persistence: Entity Framework Core (InMemory / SQLite)

Presentation: REST API

Clients: Postman / Swagger

Layers: Controller → RepresentativeService → RepresentativeMapper → IShippingAgentRepository → PortContext (EF Core)

Auth: Frontend obtains JWT (OIDC). API validates JWT via ASP.NET Auth Middleware (no direct call to IAM).

Notification: Optional email/SMS on create/update/deactivate.

### 1.10. Remarks

A representative belongs to exactly one organization; all operations are scoped by {taxNumber}.

Validation ensures the five required fields are present on create/update.

(Recommended) citizenID uniqueness per organization avoids duplicates.

Separation of concerns mirrors US 2.2.5: Controller → Service (validations) → Mapper → Repository → EF Core.