````markdown
# US 2.2.7 – Review, Approve or Reject Vessel Visit Notifications

## 1. Requirements Engineering

### 1.1. User Story Description
Como Port Authority Officer, quero revisar notificações de visita de navio pendentes e aprová‑las ou rejeitá‑las, para que os agendamentos de acostagem fiquem sob controlo do porto.

---

### 1.2. Customer Specifications and Clarifications

- O oficial do porto deve poder listar notificações com estado pendente para revisão.
- Ao aprovar, o oficial deve atribuir temporariamente uma doca/píer (`ApprovedDockId`).
- Ao rejeitar, o oficial deve fornecer uma razão (`RejectionReason`).
- Todas as decisões devem ser registadas com carimbo temporal (`DecisionTimestamp`), `OfficerId` e resultado (Approved/Rejected) para fins de auditoria.
- Depois de rejeitada, a shipping agent representative pode atualizar a notificação e submeter novamente para nova decisão.


### 1.3. Acceptance Criteria

| ID | Acceptance Criterion | Status |
|----|----------------------|--------|
| AC1 | Apenas notificações com estado `Submitted` podem ser decididas (approve/reject). | -- |
| AC2 | Ao aprovar, o oficial deve fornecer `ApprovedDockId`; `DecisionTimestamp` e `OfficerId` são registados e `Status` passa para `Approved`. | -- |
| AC3 | Ao rejeitar, o oficial deve fornecer `RejectionReason`; `DecisionTimestamp` e `OfficerId` são registados e `Status` passa para `Rejected`. | -- |
| AC4 | Todas as decisões ficam persistidas para auditoria (timestamp, officer, outcome, dock/reason). | -- |
| AC5 | API devolve códigos HTTP apropriados: 204 (sucesso sem corpo) / 400 / 404 / 409 conforme o caso. | -- |

---

### 1.4. Dependencies

| Dependency | Description |
|------------|-------------|
| US 2.2.8 – Create & Submit VVN | As notificações devem poder ser submetidas antes de serem revistas. |
| `PortContext` / EF Core | Persistência de campos de decisão e auditoria. |
| Dock catalogue | `ApprovedDockId` deve referenciar uma doca existente (tabela `Docks`). |

---

### 1.5. Input and Output Data

**Input Data (Approve):**
- OfficerId (long / string conforme sistema)
- ApprovedDockId (long)
- Notes (string, opcional)

**Input Data (Reject):**
- OfficerId (long / string)
- RejectionReason (string, required, max 500)

**Output Data:**
- 204 No Content em caso de sucesso (ou 200 com objeto se preferir)
- Mensagem de erro JSON em caso de falha (400/404/409)

---

### 1.6. Main Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/VesselVisitNotifications/{id}/approve | Approve a submitted notification and assign a dock. Body: `ApproveVvnDto`. |
| POST | /api/VesselVisitNotifications/{id}/reject | Reject a submitted notification. Body: `RejectVvnDto`. |

DTO examples (C#):

```csharp
public class ApproveVvnDto
{
    public long OfficerId { get; set; }
    public long ApprovedDockId { get; set; }
    public string? Notes { get; set; }
}

public class RejectVvnDto
{
    public long OfficerId { get; set; }
    public string RejectionReason { get; set; } = string.Empty; // max 500 chars
}
```

---

### 1.7. Example Requests (Postman / curl / PowerShell)

Approve example (JSON):

```json
{
  "officerId": 1001,
  "approvedDockId": 5,
  "notes": "Assigned dock 5 temporarily for berthing"
}
```

PowerShell:

```powershell
$uri = 'https://localhost:7167/api/VesselVisitNotifications/123/approve'
$body = @{ officerId = 1001; approvedDockId = 5; notes = 'Assigned dock 5 temporarily for berthing' } | ConvertTo-Json
Invoke-RestMethod -Uri $uri -Method Post -Body $body -ContentType 'application/json' -SkipCertificateCheck
```

curl:

```bash
curl -k -X POST "https://localhost:7167/api/VesselVisitNotifications/123/approve" \
  -H "Content-Type: application/json" \
  -d '{"officerId":1001,"approvedDockId":5,"notes":"Assigned dock 5 temporarily for berthing"}'
```

Reject example (JSON):

```json
{
  "officerId": 1001,
  "rejectionReason": "Missing cargo manifest details"
}
```

PowerShell:

```powershell
$uri = 'https://localhost:7167/api/VesselVisitNotifications/123/reject'
$body = @{ officerId = 1001; rejectionReason = 'Missing cargo manifest details' } | ConvertTo-Json
Invoke-RestMethod -Uri $uri -Method Post -Body $body -ContentType 'application/json' -SkipCertificateCheck
```

---

### 1.8. Bootstrap Data (Seeding)

Para desenvolvimento, os campos de decisão (`ApprovedDockId`, `DecisionTimestamp`, `OfficerId`, `RejectionReason`, `Status`) podem ser adicionados via migration ou ignorados em ambiente InMemory.

---

### 1.9. System Architecture (Resumo)

- **Framework:** ASP.NET Core 8.0  
- **Persistence:** Entity Framework Core (InMemory em dev)  
- **Presentation:** REST API  
- **Layers:** Controller → DTO → Service → Repository → DbContext

---

### 1.10. Remarks / Implementation Notes

- Recomenda-se manter um histórico de decisões (tabela `VesselVisitNotificationDecisions`) para auditoria completa em vez de sobrescrever apenas os campos na entidade principal.
- Implementar checagens de concorrência (rowversion/ETag) para evitar duas decisões simultâneas que causem inconsistência.
- Endpoints devem exigir autorização (role `PortOfficer`) — opcional para sprint inicial, recomendado para produção.
- Ao aprovar, pordemos opcionalmente reservar a doca (efetuar lock) até que a chegada seja confirmada.

---

### 1.11. Testes Propostos (rápido resumo)

- Unit: Service.ApproveAsync sets `Status=Approved`, escreve `ApprovedDockId`, `DecisionTimestamp`, `OfficerId`.
- Unit: Service.RejectAsync escreve `RejectionReason`, `DecisionTimestamp`, `OfficerId` e altera `Status=Rejected`.
- Integration: create->submit->approve workflow returns 204 and GET shows updated fields.

---

### 1.12. Exemplos de mensagens de erro (sugestão)

- 400 Bad Request: payload inválido (ex.: RejectionReason vazio)  
- 404 Not Found: VVN não encontrada  
- 409 Conflict: VVN já decidida ou conflito de concorrência  

````
