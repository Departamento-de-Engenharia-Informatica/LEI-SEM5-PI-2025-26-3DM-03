# Planning & Scheduling (Prolog2)

Backend service (SWI-Prolog) that exposes the scheduling algorithms via REST and can pull data from the .NET API or from fixtures.

## Endpoints
- GET  /api/scheduling/health
- POST /api/scheduling/daily — body { "date": "YYYY-MM-DD", "algorithm": "auto|optimal|heuristic|multi_crane" }
- POST /api/scheduling/generate — fetches operational data (best effort)

## Configuration
- Base URL for .NET backend: set in config.pl/1, default https://localhost:7167/api.
- Prefer backend (default off): set PROLOG_PREFER_BACKEND=true to hit .NET; default is alse (fixtures).
- Fixtures (optional): PROLOG_VESSELS_JSON, PROLOG_RESOURCES_JSON can point to JSON files (see prolog2/fixtures/).
- Enable verbose logs: set log_api_calls(true). in config.pl or override at runtime.

## Running locally
`ash
swipl -s prolog2/scheduling_server.pl -g start_scheduling_server
# then in another shell
curl -X POST http://localhost:5003/api/scheduling/daily \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-12-10","algorithm":"auto"}'
`
- To force fixtures: set PROLOG_PREFER_BACKEND=false and point PROLOG_VESSELS_JSON / PROLOG_RESOURCES_JSON to your files.
- Example fixtures:
  - ixtures/vessels_sample.json + ixtures/resources_sample.json (5 vessels)
  - ixtures/vessels_big.json + ixtures/resources_big.json (10 vessels)

## Algorithms available
- optimal (CLPFD, exhaustive) — minimizes total delay, slower on large N.
- heuristic (lgorithm":"heuristic" or "auto") — greedy (EAT/EDT/SPT/MST/combo), faster, may not be optimal.
- multi_crane — tries 1 grua first; if delay>0, re-evaluates with up to 2 gruas por operação, minimizing delay and multi-crane usage.

Responses include 	otal_delay, computation_time_ms, schedule, and for multi-crane: crane_hours_single, crane_hours_multi, cranes_allocation. Use these to compare single vs heuristic vs multi-crane in the SPA.

## Expected results (fixtures)
- essels_sample.json + esources_sample.json: ótimo (1 grua) ~33h atraso; multi-crane reduz para ~6h.
- essels_big.json + esources_big.json (10 navios, DOCK-A):
  - Ótimo (single crane): atraso ~210h (referência da ficha).
  - Heurísticas: EAT ~308h; EDT ~280h; SPT ~462h; MST ~520h (referências da ficha).
  - Multi-crane (2 gruas) deve reduzir atraso face ao single-crane; use lgorithm: "multi_crane" para ver o ganho.
