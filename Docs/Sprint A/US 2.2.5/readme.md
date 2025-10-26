# US 2.2.5 – Register Shipping Agents

## 1. Requirements Engineering

### 1.1. User Story Description

As a **Shipping Organization Representative**,  
I want to **register my organization and its representatives**,  
so that the Port Authority can approve it and allow the organization to operate within the port system.

---

### 1.2. Customer Specifications and Clarifications

From the specification document:

- Each **organization** must have at least:
  - an **identifier**,
  - **legal name** and **alternative name**,
  - an **address**,
  - and its **tax number**.
- Each organization must include **at least one representative** at the time of registration.
- Representatives must be registered with:
  - **name**, **citizen ID**, **nationality**, **email**, and **phone number**.
- The **email** and **phone number** are used for system notifications (approval decisions and authentication).

Additional clarifications:

- The Port Authority Officer will later review and validate registered organizations.
- Email/SMS confirmations are sent after submission.

---

### 1.3. Acceptance Criteria

| ID | Acceptance Criterion | Status |
|----|----------------------|--------|
| AC1 | The API allows registration with **taxNumber**, **legalName**, **alternativeName**, and **address**. | Implemented |
| AC2 | The submission must include **≥ 1 representative**. | Implemented |
| AC3 | Each representative contains **name, citizenID, nationality, email, phoneNumber**. | Implemented |
| AC4 | **Email and phoneNumber** are used for notifications (email/SMS). | Implemented |
| AC5 | The API validates that **≥ 1 representative** is present; otherwise returns **400 Bad Request**. | Implemented |
| AC6 | **taxNumber must be unique**; if already exists, the API returns **409 Conflict**. | Implemented |
| AC7 | **Address is complete** (street, city, postalCode, country) or **400 Bad Request**. | Implemented |
| AC8 | On success, API returns **201 Created** with `ShippingAgentDTO` and a **Location** header (`/api/ShippingAgents/{taxNumber}`). | Implemented |
| AC9 | Requests require authentication (JWT bearer); invalid/absent token → **401/403**. | Implemented |

---

### 1.4. Dependencies

| Dependency | Description |
|-------------|--------------|
| **PortContext** | Provides persistence for ShippingAgent and related entities. |
| **Entity Framework Core** | Used for data access and in-memory testing. |
| **Notification Service** | Sends confirmation emails/SMS after registration. |
| **External IAM Provider** | Handles authentication (OAuth 2.0 / OIDC). |

---

### 1.5. Input and Output Data

**Input (CreateShippingAgentDTO):**

- `taxNumber: long`
- `legalName: string`
- `alternativeName: string`
- `type: string` (allowed: `"Owner" | "Operator"`)
- `address: { street, city, postalCode, country }`
- `representatives: Array<{ name, citizenID, nationality, email, phoneNumber }>` (length ≥ 1)

**Output:**

- `ShippingAgentDTO` (with nested representatives and address)
- **HTTP 201 Created** + `Location` header on success
- Email/SMS confirmation dispatched

---

### 1.6. Main Endpoints

| Method | Endpoint | Description | Success | Errors |
|--------|-----------|-------------|----------|--------|
| **POST** | `/api/ShippingAgents` | Register a new shipping agent | **201 Created** (+ Location) | 400 (validation), 409 (duplicate taxNumber), 401/403 |
| **GET** | `/api/ShippingAgents/{taxNumber}` | Get a specific agent | **200 OK** | 404, 401/403 |
| **GET** | `/api/ShippingAgents` | List agents (optional for US) | **200 OK** | 401/403 |

---

### 1.7. Example Requests (Postman)

```
POST /api/ShippingAgents
{
  "taxNumber": 123456789,
  "name": "Atlantic Shipping Co.",
  "alternativeName": "Atlantic Logistics",
  "type": "Owner",
  "address": {
    "street": "Harbor Street 12",
    "city": "Lisbon",
    "postalCode": "1000-001",
    "country": "Portugal"
  },
  "representatives": [
    {
      "name": "João Silva",
      "citizenID": "12345678",
      "nationality": "Portuguese",
      "email": "joao.silva@atlantic.com",
      "phoneNumber": "+351912345678"
    }
  ]
}
```

---

### 1.8. Bootstrap Data (Seeding)
Initial shipping agents may be seeded through PortContext for testing, including example entries with addresses and representatives.

---

### 1.9. System Architecture (Summary)

**Framework:** ASP.NET Core 8.0

**Persistence:** Entity Framework Core (InMemory / SQLite)

**Presentation:** REST API

**Clients:** Postman / Swagger

**Layers:** Controller → Service → Mapper → Repository → DbContext → Notification Service

**Auth:** Frontend obtains JWT (OIDC). API validates JWT via ASP.NET Auth Middleware (no direct call to IAM).

**Notification:** Email/SMS confirmation after successful registration.

---

### 1.10. Remarks

- Validation ensures that every organization has at least one representative.  
- The notification system simulates email/SMS confirmation after successful registration.  
- The architecture follows clean separation of concerns between API, domain models, and infrastructure.
