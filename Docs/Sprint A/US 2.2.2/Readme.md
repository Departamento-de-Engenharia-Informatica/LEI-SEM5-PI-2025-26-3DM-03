#  US 2.2.2 – Manage Vessels

## 1. Requirements Engineering

### 1.1. User Story Description
As a Port Authority Officer, I want to register and update vessel records, so that valid vessels can be referenced in visit notifications.

---

### 1.2. Customer Specifications and Clarifications
- Each vessel record must include: **IMO** (7 dígitos com check digit), **name**, **vessel type** e **operator/owner**.  
- O sistema valida o **formato/algoritmo do IMO**.  
- Pesquisa e filtragem por **IMO**, **name** e **operator** (case-insensitive).  
- VesselType deve **existir** antes de associar ao Vessel.

---

### 1.3. Acceptance Criteria

| ID  | Acceptance Criterion                                                                 | Status        |
|-----|---------------------------------------------------------------------------------------|---------------|
| AC1 | Validar IMO (7 dígitos; último é check digit)                                         | Implemented   |
| AC2 | Vessel referenciado a um VesselType existente                                         | Implemented   |
| AC3 | CRUD completo (create, update, get, delete)                                           | Implemented   |
| AC4 | Pesquisa por IMO, nome e operador (case-insensitive)                                  | Implemented   |
| AC5 | Rejeitar VesselTypeId inválido / IMO inválido                                         | Implemented   |

---

### 1.4. Dependencies

| Dependency                     | Description                                           |
|--------------------------------|-------------------------------------------------------|
| US 2.2.1 – Manage Vessel Types | Vessels dependem de VesselTypes já criados           |
| PortContext / EF Core          | Persistência e mapeamentos                           |

---

### 1.5. Input and Output Data
**Input:**
- `CreateVesselDTO`: `Imo`, `Name`, `VesselTypeId`, `Operator`  
- `UpdateVesselDTO`: `Name`, `VesselTypeId`, `Operator`

**Output:**
- `VesselDTO` (inclui `VesselTypeDTO` quando carregado)
- Mensagens de confirmação/erro

---

### 1.6. Main Endpoints

| Method | Endpoint             | Description                         | Example                               |
|-------:|----------------------|-------------------------------------|----------------------------------------|
| GET    | /api/Vessels         | Lista/filtra vessels                | `/api/Vessels?operator=ShippingCo`     |
| GET    | /api/Vessels/{imo}   | Obtém vessel por IMO                | `/api/Vessels/1234567`                 |
| POST   | /api/Vessels         | Cria vessel                         | JSON body                              |
| PUT    | /api/Vessels/{imo}   | Atualiza vessel                     | JSON body                              |
| DELETE | /api/Vessels/{imo}   | Remove vessel                       | —                                      |

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
- `MV Example One` – IMO `1234567` – `VesselTypeId=1`  
- `MT Sample Tanker` – IMO `7654321` – `VesselTypeId=2`

---

### 1.9. System Architecture (Summary)
- **Framework:** ASP.NET Core 8.0  
- **Persistence:** EF Core  
- **Presentation:** REST API  
- **Layers:** Controller → Service → Mapper → Model → DbContext

---

### 1.10. Remarks
- Validação do IMO implementada em `VesselMapper.IsValidImo`.  
- Filtros case-insensitive para `name` e `operator`.  
- Erros mapeados para `400 BadRequest` (validação) e `404 NotFound` (entidade inexistente).
