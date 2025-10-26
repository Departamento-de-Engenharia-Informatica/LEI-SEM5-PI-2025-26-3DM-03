# US 2.2.9 – Review / Approve / Reject Vessel Visits

## 1. Requirements Engineering

### 1.1. User Story Description

As a **Port Authority Officer**,
I want to review submitted Vessel Visit Notifications (VVNs) and either approve, reject or request changes,
so that vessel visits are validated and assigned to appropriate docks and resources before arrival.

---

### 1.2. Customer Specifications and Clarifications

- Only authenticated Port Authority Officers can perform approval actions. Representatives may submit VVNs but cannot approve them.
- An approval typically assigns an `ApprovedDockId` and may record the approving officer id and timestamp.
- A rejection must include a reason and mark the notification as rejected.
- Requesting changes (reject with request) should allow the officer to send back a reason so the submitter can edit and re-submit.
- Approvals may trigger downstream actions (dock scheduling, notifications to shipping agent). These are out-of-scope for the core API but should be signalled by events/logging.

---

### 1.3. Acceptance Criteria

| ID | Acceptance Criterion | Status |
|----|----------------------|--------|
| AC1 | An officer can list and view VVN details (GET). | Implemented |
| AC2 | An officer can approve a submitted VVN setting the approved dock and officer id (POST /{id}/approve/{dockId}/{officerId}). | Implemented |
| AC3 | An officer can reject a submitted VVN with a reason (POST /{id}/reject/{officerId}/{reason}). | Implemented |
| AC4 | Only existing VVN ids are accepted; non-existing ids return 404. | Implemented |
| AC5 | Submitting, approving or rejecting transitions the VVN status according to the domain model. | Implemented |

---

### 1.4. Dependencies

| Dependency | Description |
|------------|-------------|
| **IVesselVisitNotificationService** | Business logic for create/submit/approve/reject flows. |
| **IVesselVisitNotificationRepository** | Persistence for VVN entities (PortContext / EF Core). |
| **PortContext (EF Core)** | Database context that stores VVNs and related entities (Docks, ShippingAgents). |
| **IShippingAgentRepository** | Optionally used to scope queries for representatives. |

---

### 1.5. Input and Output Data

**VesselVisitNotificationDTO (output / details):**
- `id: long`
- `vesselId: long`
- `agentId: long` (shipping agent)
- `arrivalDate: DateTime?`
- `departureDate: DateTime?`
- `submittedByRepresentativeEmail: string?`
- `submittedByRepresentativeName: string?`
- `status: string` (e.g., InProgress, Submitted, Approved, Rejected)
- `approvedDockId: long?`
- `approvedByOfficerId: long?`
- `approvalTimestamp: DateTime?`
- `rejectionReason: string?`

**Approve request (path params):** `dockId` and `officerId` (both numeric)

**Reject request (path params):** `officerId` and `reason` (string)

---

### 1.6. Main Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/VesselVisitNotifications` | List VVNs (filtering allowed). |
| GET | `/api/VesselVisitNotifications/{id}` | Get VVN details. |
| POST | `/api/VesselVisitNotifications/{id}/submit` | Submit VVN for review (representative). |
| POST | `/api/VesselVisitNotifications/{id}/approve/{dockId}/{officerId}` | Approve VVN and set approved dock/officer. |
| POST | `/api/VesselVisitNotifications/{id}/reject/{officerId}/{reason}` | Reject VVN with a reason. |

---

### 1.7. Example Requests

Approve (officer action):

```
POST /api/VesselVisitNotifications/42/approve/3/1001
204 No Content
```

Reject (officer action, include reason):

```
POST /api/VesselVisitNotifications/42/reject/1001/Invalid_documents
204 No Content
```

Get details:

```
GET /api/VesselVisitNotifications/42

{
  "id": 42,
  "vesselId": 7,
  "agentId": 55,
  "status": "Approved",
  "approvedDockId": 3,
  "approvedByOfficerId": 1001,
  "approvalTimestamp": "2025-10-26T10:00:00Z"
}
```

---

### 1.8. System Architecture (Summary)

- Framework: ASP.NET Core 8.0
- Persistence: Entity Framework Core (PortContext)
- Layers: Controller → Service (IVesselVisitNotificationService) → Repository → EF Core
- Auth: JWT Bearer; approval endpoints require officer privileges

---

### 1.9. Remarks

- Approvals should be idempotent: approving an already approved VVN should be a no-op or a 204.
- Rejections record a reason to allow representatives to correct and re-submit.
- Side effects (notifications, scheduling) are out-of-scope for the API but should be signalled via events/logs.
