# US 3.4.x Planning & Scheduling Module (adapted)

## 1. Goal
Provide a dedicated Planning & Scheduling back-end that exposes REST endpoints, calls scheduling algorithms in Prolog, and returns daily plans without persisting operational data. Inputs/outputs are JSON and stay aligned with the remaining modules (IDs, resource structures).

## 2. What is implemented
- REST entrypoint `POST /api/scheduling/daily?algorithm=heuristic|prolog` (see OpenAPI in `Docs/Sprint C/US Scheduling/scheduling-openapi.yaml` and Swagger at `/swagger`).
- No persistence: everything is computed in-memory per request.
- Engines (C# `ISchedulingEngine`):
  - `heuristic` -> calls Prolog `schedule4` (fast greedy, supports optional multi-crane).
  - `prolog` -> calls Prolog `schedule3` (CLPFD/optimal with automatic multi-crane fallback).
- Two Prolog endpoints exposed by `prolog/scheduling_server.pl`: `POST /schedule3`, `POST /schedule4`, plus `GET /health`.
- Comparison block: the .NET service runs the non-selected engine as baseline when available and returns summary deltas (delay, computation time).
- SPA can trigger the process through the same REST API; nothing is written to DB.

## 3. API contract (daily scheduling)
```
POST /api/scheduling/daily?algorithm=heuristic   # default if omitted
Content-Type: application/json
```
Example request:
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
  ],
  "docks": [{ "id": "dock-1" }],
  "storageAreas": []
}
```
Response (200):
```json
{
  "date": "2025-11-20",
  "algorithm": "heuristic",
  "totalDelayMinutes": 0,
  "craneHoursUsed": 42,
  "schedule": [
    {
      "vesselId": "va",
      "dockId": "dock-1",
      "craneIds": ["crane-1"],
      "staffIds": ["staff-10"],
      "startTime": "2025-11-20T06:00:00",
      "endTime": "2025-11-20T32:00:00",
      "delayMinutes": 0,
      "multiCrane": false
    }
  ],
  "warnings": [],
  "comparison": {
    "selected": { "algorithm": "heuristic", "totalDelayMinutes": 0, "computationMilliseconds": 120 },
    "baseline": { "algorithm": "prolog", "totalDelayMinutes": 0, "computationMilliseconds": 480 },
    "delayDeltaMinutes": 0,
    "computationDeltaMilliseconds": -360
  }
}
```
Full schema: `Docs/Sprint C/US Scheduling/scheduling-openapi.yaml`.

## 4. Architecture and flow
```
SPA -> .NET API (SchedulingController)
     -> ISchedulingService
        -> IOperationalDataProvider (PassThroughOperationalDataProvider)
        -> ISchedulingEngine (heuristic | prolog) via HttpClient
           -> SWI-Prolog server (schedule3/schedule4)
```
- Data provider currently trusts the payload; it can be swapped for HTTP clients that fetch vessels/resources/staff from other services (friend code already shows how to aggregate via data_service:fetch_*).
- Algorithms can be added by implementing `ISchedulingEngine` and registering in DI.

## 5. Prolog side (adapted from shared code)
- File: `prolog/scheduling_server.pl`.
- Endpoints:
  - `GET /health` -> `{status:"ok"}`.
  - `POST /schedule3` -> CLPFD/optimal; auto-fallback to multi-crane if single-crane is infeasible.
  - `POST /schedule4` -> heuristic/greedy; supports secondary crane allocation when allowed.
- Supports docks, cranes, storage, and staff windows; respects unload->load precedence and minimizes total delay.

### Running locally
```bash
cd prolog
swipl -s scheduling_server.pl
?- scheduling_server:start_server(3050).
```
Quick test:
```bash
curl -X POST http://localhost:3050/schedule4 \
  -H "Content-Type: application/json" \
  -d "{\"vessels\":[{\"id\":\"v1\",\"arrivalHour\":6,\"departureHour\":30,\"unloadDuration\":4,\"loadDuration\":5}],\"docks\":[{\"id\":\"dock-1\"}],\"cranes\":[{\"id\":\"c1\",\"startHour\":0,\"endHour\":24}],\"staff\":[{\"id\":\"s1\",\"skills\":[\"crane\"],\"startHour\":0,\"endHour\":24}]}"
```

## 6. Mapping to acceptance criteria
- **3.4.1 REST API & data consumption**: `/api/scheduling/daily` documented in OpenAPI; Prolog endpoints consume JSON only; no persistence; C# layer ready to swap pass-through provider for real HTTP clients to staff/resources/vessels APIs.
- **3.4.2 Daily schedule minimises delay**: CLPFD model minimizes total delay with constraints (one vessel per dock at a time, one crane per operation, storage/staff windows). SPA triggers computation and receives warnings for infeasibility.
- **3.4.3 Complexity analysis**: CLPFD model is exponential in vessel count (constraint search). Greedy heuristic provides faster alternative; timings are returned to support measurements.
- **3.4.4 Alternative heuristic**: `schedule4` exposed as `algorithm=heuristic`, focused on speed; returns comparable metrics (delay, crane-hours, warnings).
- **3.4.5 Multi-crane support**: `schedule3` falls back to multi-crane when single-crane cannot remove delay; `schedule4` can allocate a secondary crane when beneficial and reports `multiCrane=true` plus crane-hours.

## 7. Next steps to finish the integration
- Replace `PassThroughOperationalDataProvider` with HTTP clients that call the existing Vessels/Resources/Staff APIs (reuse the friend code pattern).
- Add OpenAPI documentation for Prolog endpoints or mirror them in the .NET spec.
- Add SPA screen to launch the scheduling run, show progress, table, and optional timeline with warnings.
