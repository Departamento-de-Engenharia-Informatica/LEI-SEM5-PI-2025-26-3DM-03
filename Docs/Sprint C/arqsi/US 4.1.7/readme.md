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

**Input (Create VVE):**
- `vvnId` - ID da Vessel Visit Notification
- `actualArrivalTime` - Data/hora de chegada real

**Input (Update VVE):**
- `actualBerthTime` - Data/hora de atracação
- `dockId` - Identificador do cais

**Input (Complete VVE):**
- `actualUnberthTime` - Data/hora de desatracação
- `actualPortDepartureTime` - Data/hora de saída do porto

**Output:**
- VVE completo com: id, identifier, vvnId, vesselName, status, timestamps, createdBy

---

### 1.6. Main Endpoints

| Method | Endpoint | Descrição |
|--------|----------|-----------|
| **POST** | `/oem/vessel-visit-executions` | Criar VVE |
| **GET** | `/oem/vessel-visit-executions` | Listar VVEs |
| **GET** | `/oem/vessel-visit-executions/:id` | Obter VVE por ID |
| **PATCH** | `/oem/vessel-visit-executions/:id` | Atualizar com tempo de atracação |
| **PATCH** | `/oem/vessel-visit-executions/:id/complete` | Marcar como completo |

---

### 1.7. Example Requests

**Criar VVE:**
```json
POST /oem/vessel-visit-executions
{
  "vvnId": 1,
  "actualArrivalTime": "2026-01-04T14:30:00Z"
}
```

**Listar VVEs:**
```
GET /oem/vessel-visit-executions?from=2026-01-01&to=2026-01-31&status=in-progress
```

**Atualizar VVE:**
```json
PATCH /oem/vessel-visit-executions/5
{
  "actualBerthTime": "2026-01-04T16:00:00Z",
  "dockId": "DOCK-A1"
}
```

**Completar VVE:**
```json
PATCH /oem/vessel-visit-executions/5/complete
{
  "actualUnberthTime": "2026-01-04T22:00:00Z",
  "actualPortDepartureTime": "2026-01-05T00:30:00Z"
}
```

---

### 1.8. Bootstrap Data (Seeding)
Initial VVEs are **not seeded** during application startup. VVEs are created dynamically in real-time when vessels arrive at the port. Test data can be generated via the API for development/testing purposes. The OEM module includes seed scripts for reference data (incident types, complementary task categories) but not for VVEs, as they represent live operational data.

---

### 1.9. System Architecture (Summary)

- **Framework:** NestJS com TypeORM
- **Linguagem:** TypeScript
- **API:** REST com autenticação JWT (IAM)
- **Autorização:** RBAC (admin, logistics-operator)
- **Camadas:** Controller → Service → Repository → Entity → Database
- **Auditoria:** Todas as operações são logged com timestamps e user ID
- **Índices:** Otimizado para filtros por operationPlanId e status

---

### 1.10. Remarks

- **Identificador auto-gerado** no padrão VVE-YYYYMMDD-###
- **Status:** começa em `in-progress`, muda para `completed` após registar saída
- **Auditoria:** createdBy e updatedAt rastreiam todas as mudanças
- **Validação:** VVN referenciado deve existir na base de dados
- **Aviso de incompatibilidade:** se o cais atribuído diferir do planeado, um aviso é registado
- **Leitura após conclusão:** após completado, apenas admin pode fazer alterações
- **Integrações:** pode referenciar Operation Plans para rastreamento de execução
