````markdown
# US 2.2.3 – Manage Docks (Berths)

## 1. Requisitos

### 1.1. Descrição da User Story
Como Agente da Autoridade Portuária, quero registar e atualizar cais/docas (docks), para que o sistema reflita corretamente a capacidade de atracação do porto.

---

### 1.2. Especificações e esclarecimentos do cliente

Um registo de doca deve conter um identificador único, um nome/número, localização dentro do porto e características físicas (por exemplo: comprimento, profundidade, calado máximo). O agente deve indicar os tipos de embarcações permitidos para atracar nessa doca.

As docas devem ser pesquisáveis e filtráveis por nome, tipo de embarcação permitido e localização.

Busca e filtros devem ser case-insensitive e permitir pesquisa por substring (partial match).

---

### 1.3. Critérios de Aceitação

| ID | Critério de Aceitação | Estado |
|----|-----------------------|--------|
| AC1 | Uma doca deve conter: Id único, Name/Number, Location, Length (m), Depth (m), MaxDraft (m). | Implementado |
| AC2 | O sistema deve permitir criar, atualizar, recuperar e apagar docas (CRUD). | Implementado |
| AC3 | O utilizador deve listar/especificar os tipos de embarcação permitidos para cada doca. | Implementado |
| AC4 | Deve ser possível pesquisar docas por name, vesselType e location (filtros combináveis). | Implementado |
| AC5 | Pesquisa deve ser case-insensitive e suportar substring. | Implementado |

---

### 1.4. Dependências

| Dependência | Descrição |
|-------------|-----------|
| US 2.2.1 – Manage Vessel Types | Docks referenciam VesselTypes para permitir associação dos tipos permitidos. |
| PortContext (DbContext) | Registo das entidades `Dock` e relação com `VesselType`. |
| Entity Framework Core | Persistência e mapeamento relacional. |

---

## 2. Dados de Entrada e Saída

Entrada (exemplos):
- Name (string) — ex: "Dock A1"
- Location (string) — ex: "North quay, Sector 3"
- Length (decimal) — metros
- Depth (decimal) — metros
- MaxDraft (decimal) — metros
- AllowedVesselTypeIds (array[int]) — lista de ids de VesselType permitidos

Saída:
- DockDTO — representação pública (Id, Name, Location, Length, Depth, MaxDraft, AllowedVesselTypes)

---

## 3. Endpoints Principais

| Método | Endpoint | Descrição | Exemplo |
|--------|----------|-----------|---------|
| GET | /api/Docks | Lista todas as docas ou filtra por query params | `/api/Docks?name=A1&vesselTypeId=2&location=north` |
| GET | /api/Docks/{id} | Obter doca por id | `/api/Docks/1` |
| POST | /api/Docks | Criar nova doca | JSON com CreateDockDTO |
| PUT | /api/Docks/{id} | Atualizar doca existente | JSON com UpdateDockDTO |
| DELETE | /api/Docks/{id} | Apagar doca | — |

Query params suportados na listagem:
- name — partial, case-insensitive
- vesselTypeId — filtrar docas que permitam esse tipo de embarcação
- location — partial, case-insensitive
- page, pageSize — paginação (opcional)

---

## 4. Exemplos de Requests / Responses

POST /api/Docks (CreateDockDTO)

```json
{
  "name": "Dock A1",
  "location": "North quay, Sector 3",
  "length": 220.5,
  "depth": 12.0,
  "maxDraft": 11.5,
  "allowedVesselTypeIds": [1, 3]
}
```

Response 201 Created — DockDTO

```json
{
  "id": 5,
  "name": "Dock A1",
  "location": "North quay, Sector 3",
  "length": 220.5,
  "depth": 12.0,
  "maxDraft": 11.5,
  "allowedVesselTypes": [
    { "id": 1, "name": "Container Ship" },
    { "id": 3, "name": "Tug" }
  ]
}
```

---

## 5. Modelos e DTOs (C# – Sugestão)

Model `Dock` (exemplo simplificado):

```csharp
public class Dock
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string Location { get; set; } = null!;
    public decimal Length { get; set; }
    public decimal Depth { get; set; }
    public decimal MaxDraft { get; set; }

    // Relação muitos-para-muitos com VesselType
    public ICollection<VesselType> AllowedVesselTypes { get; set; } = new List<VesselType>();
}
```

DTOs:

```csharp
public class CreateDockDTO
{
    public string Name { get; set; } = null!;
    public string Location { get; set; } = null!;
    public decimal Length { get; set; }
    public decimal Depth { get; set; }
    public decimal MaxDraft { get; set; }
    public List<int> AllowedVesselTypeIds { get; set; } = new();
}

public class UpdateDockDTO : CreateDockDTO { }

public class DockDTO
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string Location { get; set; } = null!;
    public decimal Length { get; set; }
    public decimal Depth { get; set; }
    public decimal MaxDraft { get; set; }
    public List<VesselTypeDTO> AllowedVesselTypes { get; set; } = new();
}
```

Mapper (exemplo):

```csharp
// Map CreateDockDTO -> Dock and populate AllowedVesselTypes by querying VesselType ids from db
// Map Dock -> DockDTO including nested VesselTypeDTOs
```

---

## 6. Mapeamento EF Core (PortContext)

Adicionar `DbSet<Dock> Docks` no `PortContext` e configurar a relação muitos-para-muitos (Dock <-> VesselType):

```csharp
public DbSet<Dock> Docks { get; set; }

protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    base.OnModelCreating(modelBuilder);

    modelBuilder.Entity<Dock>()
        .HasMany(d => d.AllowedVesselTypes)
        .WithMany(v => v.AllowedDocks); // supondo a coleção inversa em VesselType

    // Seeds example below
}
```

Se `VesselType` ainda não tiver a coleção inversa, adicionar:

```csharp
public class VesselType
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    // ... outras props ...
    public ICollection<Dock> AllowedDocks { get; set; } = new List<Dock>();
}
```

---

## 7. Bootstrap / Seeder (exemplos)

Exemplo de dados iniciais para testes:

- VesselTypes: 1: Container Ship, 2: Tanker, 3: Tug
- Docks:
  - Id:1, Name: "Dock A1", Location: "North quay", Length: 200, Depth: 10, MaxDraft: 9.5, AllowedVesselTypes: [1,3]
  - Id:2, Name: "Dock B2", Location: "South pier", Length: 80, Depth: 6, MaxDraft: 5.5, AllowedVesselTypes: [3]

---

## 8. Regras de Negócio e Validações

- Name e Location: required, comprimento máximo sugerido 200 caracteres.
- Length, Depth, MaxDraft: valores positivos; Length e Depth com precisão decimal adequada.
- Ao atribuir AllowedVesselTypeIds, validar existência desses VesselType ids na base.
- Impor integridade referencial: se um VesselType for apagado, decidir política (remover associação ou impedir exclusão).

---

## 9. Casos de Teste Sugeridos

- Unit tests (DockMapper)
  - Criar Dock a partir de CreateDockDTO com AllowedVesselTypeIds -> verifica relações mapeadas.
  - Mapear Dock -> DockDTO inclui VesselTypeDTOs corretos.

- Integration tests (API)
  - Criar doca via POST e verificar GET por id devolve os dados corretos.
  - Atualizar doca e verificar alterações persistem.
  - Remover doca e garantir que GET/{id} retorna 404.
  - Pesquisas: listar com ?name=partial, ?vesselTypeId=X e combinar filtros; garantir case-insensitive.

---

## 10. Observações e Próximos Passos

- A implementação atual usa um padrão Controller → DTO → Mapper → Model → DbContext idêntico ao de `VesselType` (US 2.2.1). Recomenda-se reusar componentes e convenções existentes (`VesselTypeMapper`, `PortContext` seed). 
- Considerar paginação e ordenação na listagem de docas quando o número de registos for elevado.
- Documentar no Swagger/OpenAPI os modelos e filtros (atribuir exemplos aos endpoints).

---

## 11. Referências

- US 2.2.1 – Manage Vessel Types (modelo de documentação e convenções técnicas)
- Arquitetura do projecto e `PortContext` (DbContext)

````
