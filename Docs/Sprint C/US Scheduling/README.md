# US 3.4.1 – Planning & Scheduling Service

## 1. Objetivo
Como System Administrator / Planner quero um módulo que receba pedidos REST (JSON), execute algoritmos de scheduling (idealmente em Prolog) e responda com um plano diário sem gravar nada em base de dados. O módulo tem de estar documentado em OpenAPI e consumir dados dos restantes serviços (navios, gruas, staff), mesmo que numa 1.ª versão os receba no próprio body.

## 2. Requisitos cumpridos
- Endpoint `POST /api/scheduling/daily` (ver OpenAPI) aceita `date`, `strategy`, `vessels`, `cranes` e `staff`.
- Sem persistência: tudo vive em memória no request.
- Algoritmos configuráveis via query `algorithm`. Neste momento:
  - `optimal` – mock sequencial em .NET (fallback).
  - `prolog` – chama o servidor SWI‑Prolog via HTTP.
- Swagger disponível em `/swagger`.
- Integração preparada para motores externos (Prolog) usando `ISchedulingEngine`.

## 3. API
```
POST /api/scheduling/daily?algorithm=prolog
Content-Type: application/json
```
Request (exemplo):
```json
{
  "date": "2025-11-20",
  "strategy": "single-crane",
  "vessels": [
    { "id": "va", "arrivalHour": 6, "departureHour": 63, "unloadDuration": 10, "loadDuration": 16 },
    { "id": "vb", "arrivalHour": 23, "departureHour": 50, "unloadDuration": 9, "loadDuration": 7 }
  ],
  "cranes": [
    { "id": "crane-1", "availableFrom": "2025-11-20T06:00:00Z", "availableTo": "2025-11-20T18:00:00Z" }
  ],
  "staff": [
    { "id": "staff-10", "skills": ["crane"], "shiftStart": "2025-11-20T05:00:00Z", "shiftEnd": "2025-11-20T15:00:00Z" }
  ]
}
```
Response (`200 OK`):
```json
{
  "date": "2025-11-20",
  "algorithm": "prolog",
  "totalDelayMinutes": 2220,
  "craneHoursUsed": 42,
  "schedule": [
    {
      "vesselId": "va",
      "dockId": "dock-1",
      "craneIds": ["crane-1"],
      "staffIds": ["staff-10"],
      "startTime": "2025-11-20T06:00:00",
      "endTime": "2025-11-20T32:00:00",
      "delayMinutes": 300,
      "multiCrane": false
    }
  ],
  "warnings": []
}
```
Especificação completa em `Docs/Sprint C/US Scheduling/scheduling-openapi.yaml`.

## 4. Arquitetura (backend)
```
SchedulingController
    ↓
ISchedulingService (SchedulingService)
    • IOperationalDataProvider (PassThroughOperationalDataProvider)
    • IEnumerable<ISchedulingEngine>
         ├─ MockSchedulingEngine (“optimal”)
         └─ PrologHttpSchedulingEngine (“prolog”) -> HttpClient -> SWI-Prolog
```
- O provider atual apenas passa os dados recebidos; trocar facilmente por clients HTTP que vão buscar info a Vessels/Staff/Resources.
- Novos motores bastam implementar `ISchedulingEngine` e registá-los no DI.

## 5. Servidor SWI-Prolog
Código em `prolog/scheduling_server.pl`:
- Bibliotecas: `thread_httpd`, `http_dispatch`, `http_json`.
- Endpoints:
  - `GET /health` → `{status:"ok"}`.
  - `POST /schedule` → recebe `{ "vessels": [...] }`, executa o algoritmo (permutação + cálculo de atraso) e responde com `{ sequence: [...], totalDelayHours: N, warnings: [] }`.
- Os dados de cada navio têm campos `id`, `arrivalHour`, `departureHour`, `unloadDuration`, `loadDuration`.
- `sequence` devolve tripletos com `vessel`, `startHour`, `endHour`, `delayHours`.

### Executar o servidor
```bash
cd prolog
swipl -s scheduling_server.pl
?- scheduling_server:start_server(5000).
```
Teste rápido:
```bash
curl -X POST http://localhost:5000/schedule \
     -H "Content-Type: application/json" \
     -d '{"vessels":[{"id":"va","arrivalHour":6,"departureHour":63,"unloadDuration":10,"loadDuration":16}]}'
```
Para parar: `?- scheduling_server:stop_server.` ou Ctrl+C no terminal.

## 6. Integração .NET ↔ Prolog
- Configurações em `appsettings*.json` → `Scheduling.PrologBaseUrl`. Por omissão `http://localhost:5000/`.
- `PrologHttpSchedulingEngine` é um typed client (`HttpClient`) que faz POST `schedule`, valida `200 OK` e converte o JSON para `SchedulingComputationResult`.
- Query parameter `algorithm=prolog` ativa o motor Prolog; se omitido fica `optimal` (mock).
- `TotalDelayMinutes` = `totalDelayHours` * 60.

## 7. Fluxo de testes
1. **Arrancar Prolog** (`swipl … start_server(5000).`).
2. **Arrancar API .NET** (`DISABLE_OIDC=true dotnet run`).
3. Abrir Swagger → `POST /api/scheduling/daily` → `algorithm=prolog` → body com navios.
4. Confirmar `200 OK` com dados provenientes do motor Prolog. Se o motor estiver em baixo, o .NET devolve erro 5xx.
5. Testes negativos:
   - `algorithm=foo` → 400.
   - Sem `vessels` → 400 (provider recusa).

## 8. Próximos passos
1. Trocar `PassThroughOperationalDataProvider` por clientes que vão buscar navios/gruas/staff aos restantes serviços.
2. Evoluir o servidor Prolog para suportar múltiplas estratégias (heurísticas, multi-crane).
3. Adicionar autenticação/mTLS entre .NET e Prolog se for exposto fora da LAN.
4. Criar página na SPA para consumir o endpoint e visualizar o plano.
