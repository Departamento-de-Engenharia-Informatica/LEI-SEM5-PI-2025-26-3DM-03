# Automated Deployment Pipeline for TodoApi

## Overview
This document describes the automated, reproducible, and test-plan-validated deployment process for the `TodoApi` module. It fully addresses User Story 3.5.1:

- Automated pipeline execution (CI/CD via GitHub Actions)
- Automated validation using the defined test plan (`Docs/Testing/test-cases.md`)
- Archival of deployment logs and test results for traceability
- Reproducible, isolated environment (Docker container image / DEI VM)
- Configurable schedule (daily cron + manual overrides)

## Pipeline Location
Workflow file: `.github/workflows/deploy-todoapi.yml`

## Triggers
- Push to `main` that touches `TodoApi/**`, `frameworkDDD/**`, or the workflow itself.
- Scheduled run: `0 2 * * *` (daily at 02:00 UTC). Adjust the cron in the workflow to change cadence.
- Manual dispatch (`workflow_dispatch`) with these inputs:
  - `runTestsOnly` — execute build/tests without building or pushing the container.
  - `disableOidc` — sets `DISABLE_OIDC=true` for builds/smoke tests to bypass identity providers.
  - `imageTag` — override for the Docker tag (default `yyyyMMdd-HHmm-<shortSha>`).
  - `scheduleOverride` — optional cron string stored in logs (documentation only).
  - `deployToDei` + `deiHost/deiUser/deiPort/containerName/hostPort` — enable remote deployment.

## Stages
1. **Build & Test**
   - Restores and builds the solution targeting .NET 8.0.
   - Runs `dotnet test testes/Domain.Tests/Domain.Tests.csproj --logger "trx;LogFileName=tests.trx"` with Coverlet (Cobertura output) to implement TC-DOM-001/002.
   - Publishes artifacts:
     - `test-results`: TRX + coverage XML (30-day retention).
     - `build-logs`: compiled assemblies + dependency manifests (14-day retention).
2. **Containerize** *(skipped when `runTestsOnly=true`)*
   - Builds the multi-stage Docker image defined in `TodoApi/Dockerfile`.
   - Pushes tags to GHCR (`ghcr.io/<org>/<repo>-todoapi:<tag>` and `:latest`).
   - Smoke tests the container (`docker run` + `curl /WeatherForecast`) capturing TC-API-001 and TC-SEC-001.
   - Uploads `smoke-test` artifact with startup logs.
3. **Summary**
   - Prints completion notes with pointers to published images and artifacts.
4. **(Opcional) Deploy to DEI VM via SSH**
   - Desligado por defeito. Ativa com `deployToDei=true` num run manual.
   - Requisitos (guardar como Secrets no repositório ou organização):
     - `DEI_HOST`, `DEI_USER`, `DEI_PORT` (opcional), `DEI_SSH_KEY`
     - `GHCR_USER`, `GHCR_PAT` (scope `read:packages`)
   - O job liga via `appleboy/ssh-action`, faz login no GHCR, faz `docker pull` da imagem construída nessa run, remove o container antigo e arranca o novo com `--restart unless-stopped` expondo a porta configurada.

## Artifacts & Retention
| Artifact | Contents | Retention |
|----------|----------|-----------|
| `test-results` | `*.trx`, `coverage.cobertura.xml` | 30 days |
| `build-logs` | Release binaries + `project.assets.json` snapshots | 14 days |
| `smoke-test` | `smoke.log` from container run | 14 days |

Adjust `retention-days` in the workflow if a longer audit trail is necessary.

## Reproducible Environment
- Build stage pins `mcr.microsoft.com/dotnet/sdk:8.0`, runtime uses `mcr.microsoft.com/dotnet/aspnet:8.0`.
- `ASPNETCORE_URLS=http://0.0.0.0:8080` and `DISABLE_OIDC=true` are injected so the container boots deterministically in CI/DEI.
- Docker image encapsulates all dependencies; deployments merely pull/run the tagged artifact.

### Local Reproduction
```bash
# Build image
docker build -f TodoApi/Dockerfile -t todoapi:dev .
# Run
docker run -p 8080:8080 -e DISABLE_OIDC=true --name todoapi_dev todoapi:dev
# Smoke test
curl http://localhost:8080/WeatherForecast
```

## Configuration & Secrets
- For real OIDC usage set `Authentication__Google__ClientId`/`Secret` and run with `DISABLE_OIDC=false`.
- Map additional environment variables through `docker run -e` or infrastructure configuration as needed.

### DEI VM Deployment (detalhes)
1. Configura os secrets listados acima (host, user, chave privada, credenciais GHCR).
2. Em *Actions > Deploy TodoApi > Run workflow* define `deployToDei=true` e, se necessário, overrides para `deiHost/deiUser/deiPort/containerName/hostPort`.
3. O job vai fazer pull da tag construída nessa execução e lançar o container correspondente na VM isolada do DEI.

## Modifying Schedule
To change cadence edit:
```yaml
schedule:
  - cron: '0 2 * * *'
```
Example weekly Sunday 01:00 UTC: `'0 1 * * 0'`. Manual runs with `scheduleOverride` document ad-hoc validations in logs.

## Logging & Traceability
- GitHub Actions retains full console logs for each job plus downloadable artifacts.
- Artifact retention ensures audits of tests/builds/smoke checks for up to 30 days.
- Image tags encode timestamp + short SHA (e.g., `20251111-0210-a1b2c3d`) enabling deterministic rollback.

## Test Plan Integration
`Docs/Testing/test-cases.md` defines the official catalogue (TC-DOM-001 … TC-SEC-002). The workflow enforces these mappings:

| Stage | Automated Test Cases | Evidence |
|-------|---------------------|----------|
| `build-test` job | TC-DOM-001, TC-DOM-002 (domain invariants, scheduling rules) | `test-results` artifact (TRX + Cobertura) |
| `containerize` > Smoke test | TC-API-001, TC-SEC-001 (API health, OIDC-disabled bootstrap) | `smoke-test/smoke.log`, job logs |
| Planned additions | TC-API-002, TC-SEC-002 (integration + auth happy-path) | Add new steps & artifacts when implemented |
| Manual DEI checklist (optional) | Any TC flagged as manual in the plan | Notes attached to the workflow run |

When new scenarios are automated, update both the workflow and the test plan so IDs remain traceable.

## Extensibility / Next Steps
1. Environment promotion with staged approvals.
2. Container/security scanning (Trivy, Dependabot).
3. SBOM generation (`dotnet sbom` or `syft`).
4. Infrastructure as Code for VM/container provisioning.
5. Blue/Green or canary deployments.
6. Persistent data stores behind feature toggles.
7. Observability (structured logs, metrics, tracing).

## Troubleshooting
| Issue | Symptom | Resolution |
|-------|---------|------------|
| OIDC secrets missing | App fails to boot with configuration exception | Run with `disableOidc=true` or provide the secrets. |
| Smoke test fails | `/WeatherForecast` times out or 5xx | Inspect `smoke.log`, confirm migrations/ports. |
| Coverage missing | No Cobertura XML in artifacts | Ensure `coverlet.collector` referenced and tests executed without filters. |
| Image not pushed | GHCR tags absent | Verify permissions and that `runTestsOnly` is false. |

## Acceptance Criteria Mapping
- Automated pipeline: `.github/workflows/deploy-todoapi.yml`.
- Automated validation: Pipeline enforces cases listed in `Docs/Testing/test-cases.md`.
- Logs & test results archived: `upload-artifact` steps for every validation stage.
- Reproducible, isolated environment: Docker images + optional DEI container host.
- Configurable schedule: Cron trigger + manual inputs for overrides.

---
Maintainer: System Administration Team  
Last Updated: {{DATE}}
