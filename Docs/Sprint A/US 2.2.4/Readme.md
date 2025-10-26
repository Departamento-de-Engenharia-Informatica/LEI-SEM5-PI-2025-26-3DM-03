#  US 2.2.4 – Manage Storage Areas

## 1. Requirements Engineering

### 1.1. User Story Description
As a Port Authority Officer, I want to register and update storage areas, so that (un)loading and storage operations can be assigned to the correct locations.

---

### 1.2. Customer Specifications and Clarifications
- **StorageArea** tem **Id**, **Type** (`Yard`/`Warehouse`), **Location**, **MaxCapacityTEU**, **CurrentOccupancyTEU**.  
- Por defeito, serve todos os docks; opcionalmente, restringe via **ServedDockIds**.  
- **DockDistances** (dockId → distância em metros) guardado para planeamento futuro.  
- **Regra:** `CurrentOccupancyTEU` **não pode exceder** `MaxCapacityTEU`.  
- Filtragem por `type`, `location`, `servedDockId`.

---

### 1.3. Acceptance Criteria

| ID  | Acceptance Criterion                                                                            | Status      |
|-----|--------------------------------------------------------------------------------------------------|-------------|
| AC1 | Atributos base (Id, Type, Location, MaxCapacityTEU, CurrentOccupancyTEU)                        | Implemented |
| AC2 | Regra de negócio: Occupancy ≤ Capacity                                                           | Implemented |
| AC3 | ServedDockIds válidos (existem como Docks)                                                       | Implemented |
| AC4 | Guardar `ServedDockIds` e `DockDistances` (ValueConverters JSON)                                 | Implemented |
| AC5 | Pesquisa/filtragem por type, location e servedDockId                                             | Implemented |
| AC6 | CRUD completo de storage areas                                                                   | Implemented |

---

### 1.4. Dependencies

| Dependency           | Description                                           |
|----------------------|-------------------------------------------------------|
| US 2.2.3 – Docks     | Validação de `ServedDockIds`                          |
| PortContext / EFCore | Persistência e conversores JSON para coleções         |

---

### 1.5. Input and Output Data
**Input:**
- `CreateStorageAreaDTO`: `Type`, `Location`, `MaxCapacityTEU`, `CurrentOccupancyTEU`, `ServedDockIds`, `DockDistances`  
- `UpdateStorageAreaDTO`: `Location?`, `MaxCapacityTEU?`, `CurrentOccupancyTEU?`, `ServedDockIds?`, `DockDistances?`

**Output:**
- `StorageAreaDTO`  
- Mensagens de confirmação/erro

---

### 1.6. Main Endpoints

| Method | Endpoint                 | Description                                  | Example                                                  |
|-------:|--------------------------|----------------------------------------------|----------------------------------------------------------|
| GET    | /api/StorageAreas        | Lista/filtra storage areas                    | `/api/StorageAreas?type=Yard&location=North&servedDockId=1` |
| GET    | /api/StorageAreas/{id}   | Obtém por id                                  | `/api/StorageAreas/1`                                    |
| POST   | /api/StorageAreas        | Cria storage area                             | JSON body                                                |
| PUT    | /api/StorageAreas/{id}   | Atualiza storage area                         | JSON body                                                |
| DELETE | /api/StorageAreas/{id}   | Remove storage area                           | —                                                        |

---

### 1.7. Example Requests (Postman)
```
GET /api/StorageAreas
GET /api/StorageAreas?type=Warehouse
GET /api/StorageAreas?servedDockId=2
GET /api/StorageAreas/1
POST /api/StorageAreas
PUT /api/StorageAreas/1
DELETE /api/StorageAreas/3
```

---

### 1.8. Bootstrap Data (Seeding)
- Sem registos obrigatórios iniciais.  
- Podem ser criadas dinamicamente conforme a operação.

---

### 1.9. System Architecture (Summary)
- **Framework:** ASP.NET Core 8.0  
- **Persistence:** EF Core (ValueConverters JSON para listas/dicionários)  
- **Presentation:** REST API  
- **Layers:** Controller → Service → Repository → Model → DbContext

---

### 1.10. Remarks
- `StorageAreaService` aplica regra `Occupancy ≤ Capacity` em create/update.  
- Validação de `ServedDockIds` contra `IDockRepository`.  
- Filtros implementados em `EfStorageAreaRepository.GetAllAsync` (type/location/servedDockId).
