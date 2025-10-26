````markdown
# US 2.2.8 – Create & Submit Vessel Visit Notification

## 1. Requirements Engineering

### 1.1. User Story Description
Como Shipping Agent Representative, quero criar e submeter uma Vessel Visit Notification (VVN), para que o acostagem do navio e as operações de carga/descarga no porto sejam planeadas em espaço e tempo.

---

### 1.2. Customer Specifications and Clarifications

- O representate deve poder criar uma VVN que inclua o cargo manifest (lista de contentores para loading/unloading) e, quando necessário, informação sobre tripulação (nome, citizen id, nacionalidade).
- O sistema deve validar que os identificadores de contentores obedecem ao padrão ISO 6346:2022.
- A VVN pode ficar em estado "InProgress" se a informação estiver incompleta e o agente poderá atualizá-la posteriormente.
- Quando completa e pronta para revisão, o agente deve submeter a VVN: `Status` passa para "Submitted".


### 1.3. Acceptance Criteria

| ID | Acceptance Criterion | Status |
|----|----------------------|--------|
| AC1 | VVN must contain cargo manifest entries for loading and/or unloading. | -- |
| AC2 | Container identifiers must be validated against ISO 6346:2022. | -- |
| AC3 | Crew information (name, citizen id, nationality) may be included when required. | -- |
| AC4 | VVN may be saved as `InProgress` if incomplete; agent can update later. | -- |
| AC5 | When agent marks VVN as `Submitted`, it becomes available for Port Authority review (status changes to `Submitted`). | -- |
| AC6 | API must return 400 Bad Request if container identifiers fail ISO 6346 validation. | -- |

---

### 1.4. Dependencies

| Dependency | Description |
|------------|-------------|
| US 2.2.7 – Review/Approve/Reject VVN | Requires submitted VVN to allow decisions. |
| PortContext / EF Core | Persistência de VVN e manifestos. |
| Container validation utility | Implementação do validador ISO 6346 (regex + check digit). |

---

### 1.5. Input and Output Data

**Input Data (Create / Update):**
- VesselId (string / IMO)
- AgentId (long)
- ArrivalDate, DepartureDate (DateTime?)
- CargoManifest: array of container items { containerCode, cargoType, isForUnloading }
- CrewMembers: array of { name, citizenId, nationality }
- Status: optional (defaults to "InProgress")

**Action (Submit):**
- Agent performs submit action to change `Status` -> "Submitted".

**Output Data:**
- On create: 201 Created with VesselVisitNotificationDTO
- On invalid container id: 400 Bad Request with error message

---

### 1.6. Main Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/VesselVisitNotifications | Create a new VVN (body: CreateVvnDto) |
| PUT | /api/VesselVisitNotifications/{id} | Update an existing VVN (body: UpdateVvnDto) |
| POST | /api/VesselVisitNotifications/{id}/submit | Submit a VVN (body: SubmitVvnDto or empty) |
| GET | /api/VesselVisitNotifications | List VVN (filter by status) |
| GET | /api/VesselVisitNotifications/{id} | Get VVN by id |

DTO examples (C#):

```csharp
public class ContainerItemDto {
  public string ContainerCode { get; set; } = string.Empty; // ISO 6346
  public string CargoType { get; set; } = string.Empty;
  public bool IsForUnloading { get; set; }
}

public class CrewMemberDto {
  public string Name { get; set; } = string.Empty;
  public string CitizenId { get; set; } = string.Empty;
  public string Nationality { get; set; } = string.Empty;
}

public class CreateVvnDto {
  public string VesselId { get; set; } = string.Empty;
  public long AgentId { get; set; }
  public DateTime ArrivalDate { get; set; }
  public DateTime? DepartureDate { get; set; }
  public List<ContainerItemDto> CargoManifest { get; set; } = new();
  public List<CrewMemberDto> CrewMembers { get; set; } = new();
  // Optional: status (defaults to "InProgress")
}

public class SubmitVvnDto {
  public long AgentId { get; set; }
}
```

---

### 1.7. Example Requests (Postman / PowerShell / curl)

Create (PowerShell):

```powershell
$uri = 'https://localhost:7167/api/VesselVisitNotifications'
$body = @{
  vesselId = 'IMO1234567'
  agentId = 42
  arrivalDate = '2025-11-10T08:00:00Z'
  cargoManifest = @(
    @{ containerCode = 'MSCU1234567'; cargoType = 'General'; isForUnloading = $true },
    @{ containerCode = 'MSCU7654321'; cargoType = 'Hazardous'; isForUnloading = $false }
  )
  crewMembers = @(
    @{ name = 'John Doe'; citizenId = 'C12345'; nationality = 'PT' }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri $uri -Method Post -Body $body -ContentType 'application/json' -SkipCertificateCheck
```

Submit (PowerShell):

```powershell
$uri = 'https://localhost:7167/api/VesselVisitNotifications/123/submit'
$body = @{ agentId = 42 } | ConvertTo-Json
Invoke-RestMethod -Uri $uri -Method Post -Body $body -ContentType 'application/json' -SkipCertificateCheck
```

If any containerCode fails ISO 6346 validation, the API should return 400 with a message like:

```json
{ "error": "Invalid container identifier: MSCU12X4567" }
```

---

### 1.8. Bootstrap Data (Seeding)

- Para desenvolvimento basta usar InMemory DB; dados de VVN são voláteis entre reinícios. Se DB persistente for utilizado, criar migration para campos novos (CargoManifest, CrewMembers) como tabelas/coleções.

---

### 1.9. System Architecture (Resumo)

- **Framework:** ASP.NET Core 8.0  
- **Persistence:** Entity Framework Core (InMemory/SQL)  
- **Validation:** ISO 6346 check (regex + check digit algorithm)  
- **Layers:** Controller → DTO → Mapper → Service → Repository → DbContext

---

### 1.10. Remarks / Implementation Notes

- Container validation: além do regex (^[A-Z]{4}\d{7}$) é recomendável verificar o dígito de verificação (mod 11 algorithm) para conformidade com ISO 6346.
- Ao gravar CargoManifest/CrewMembers no EF, usar entidades relacionadas (HasMany) ou Owned collections conforme conveniência do modelo.
- `Status` enum/string com valores { InProgress, Submitted, Approved, Rejected }.
- Ao submeter, guardar `SubmissionTimestamp = DateTime.UtcNow`.
- Ao validar containers, devolver 400 com detalhe de erro quando houver identificadores inválidos.

---

### 1.11. Testes Propostos

- Unit: validador ISO 6346 (várias cadeias válidas/invalidas, check digit correctness).
- Unit: Service.CreateAsync cria VVN com Status = "InProgress" e valida containers; Update mantém validação.
- Integration: create -> update -> submit flow: create returns 201, submit returns 204 and subsequent GET shows Status=Submitted and SubmissionTimestamp.

---

### 1.12. Exemplos de mensagens de erro

- 400 Bad Request: `{"error":"Invalid container identifier: ..."}`
- 404 Not Found: `{"error":"VesselVisitNotification not found"}`
- 409 Conflict: `{"error":"VVN already submitted or decided"}`

````