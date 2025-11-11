# Automated Deployment Pipeline for TodoApi

## Overview
This document describes the automated, reproducible, and test‑validated deployment process for the `TodoApi` module. It satisfies User Story 3.5.1 requirements:

- Automated pipeline execution (CI/CD via GitHub Actions)
- Automated validation using the existing test plan (unit tests + coverage)
- Archival of deployment logs and test results for traceability
- Reproducible, isolated environment (Docker container image)
- Configurable schedule (daily at 02:00 UTC, adjustable + manual dispatch)

## Pipeline Location
Workflow file: `.github/workflows/deploy-todoapi.yml`

## Triggers
- Push to `main` affecting `TodoApi/**` or shared framework code.
- Scheduled run: daily `0 2 * * *` (02:00 UTC) – can be modified in the workflow file.
- Manual run ("Run workflow") with optional inputs:
  - `runTestsOnly` – skip container build/push.
  - `disableOidc` – sets `DISABLE_OIDC=true` so app can start without OIDC secrets.
  - `imageTag` – custom tag override (otherwise date+short SHA).

## Stages
1. Build & Test
   - Restores and builds solution (`net8.0`).
   - Executes tests: `Domain.Tests` with coverage (`coverlet`, Cobertura format).
   - Publishes artifacts:
     - `test-results`: TRX + coverage XML.
     - `build-logs`: compiled assemblies + dependency assets for traceability.
2. Containerize (skipped if `runTestsOnly=true`)
   - Builds multi-stage Docker image using `TodoApi/Dockerfile`.
   - Tags and pushes to GHCR: `ghcr.io/<org>/<repo>-todoapi:TAG` and `:latest`.
   - Smoke test: runs container, waits, calls `/WeatherForecast`. Uploads `smoke.log`.
3. Summary
   - Simple textual confirmation of completion.

4. (Opcional) Deploy to DEI VM via SSH
  - Desligado por defeito. Ativa com input `deployToDei=true` ao correr manualmente o workflow.
  - Requisitos (criar como Secrets do repositório ou da Organization):
    - `DEI_HOST`: hostname/IP da VM.
    - `DEI_USER`: utilizador SSH.
    - `DEI_PORT`: (opcional) porta SSH, por defeito 22.
    - `DEI_SSH_KEY`: chave privada SSH (formato PEM) para esse utilizador.
    - `GHCR_USER`: utilizador para GHCR (tipicamente o nome de utilizador GitHub ou org bot).
    - `GHCR_PAT`: Personal Access Token com scope `read:packages` para fazer `docker pull` no host DEI.
  - O job liga por SSH, faz login no GHCR, `docker pull` da imagem, remove/arranca o container novo com `--restart unless-stopped`.

## Artifacts & Retention
| Artifact | Contents | Retention |
|----------|----------|-----------|
| test-results | `*.trx`, coverage (`*.xml`) | 30 days |
| build-logs | Key build outputs, asset manifests | 14 days |
| smoke-test | Container startup + request log | 14 days |

Adjust retention in `deploy-todoapi.yml` if longer audit trail is needed.

## Reproducible Environment
- Dockerfile pins to `mcr.microsoft.com/dotnet/sdk:8.0` for build and `aspnet:8.0` for runtime.
- Runtime image variable `DISABLE_OIDC=true` by default to allow non-interactive health checks.
- Listening port: `8080` (exposed). Override via `ASPNETCORE_URLS` if required.

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
For real OIDC usage in a deployed environment:
- Provide `Authentication__Google__ClientId` and `Authentication__Google__ClientSecret` as environment variables or secret store.
- Set `DISABLE_OIDC=false` (or omit) to enable full auth flow.

### DEI VM Deployment (optional)
Para ativar o job opcional de deploy à VM DEI:
1. Configura Secrets: `DEI_HOST`, `DEI_USER`, `DEI_SSH_KEY`, e opcionalmente `DEI_PORT`; `GHCR_USER` e `GHCR_PAT` (com `read:packages`).
2. Em Actions > Deploy TodoApi > Run workflow, define `deployToDei=true` e (se quiseres) overrides para `deiHost/deiUser/deiPort/containerName/hostPort`.
3. O job vai fazer pull da tag construída nessa run e lançar o container no host DEI.

## Modifying Schedule
Edit `schedule:` block in workflow YAML. Example for weekly Sunday 01:00 UTC:
```yaml
schedule:
  - cron: '0 1 * * 0'
```

## Logging & Traceability
- GitHub Actions run logs + uploaded artifacts form the audit trail.
- Include run URL references in release notes if promoting images.
- Image tag includes timestamp + short SHA by default (e.g., `20251111-0210-a1b2c3d`).

## Test Plan Integration
Currently integrates unit tests. Extend by:
- Adding integration tests hitting the containerized API.
- Adding Postman / Newman collection step (export results as artifact).
- Adding performance smoke (k6 / bombardier) with threshold gating.

## Extensibility / Next Steps
1. Environment Promotion: Add staging/prod jobs gated by manual approval.
2. Security Scanning: Integrate container scanning (e.g., Trivy) and dependency audit.
3. SBOM Generation: `dotnet sbom` or `syft` to attach SBOM artifact.
4. Infrastructure as Code: Provision target VM or K8s namespace via Terraform step.
5. Blue/Green or Canary Deploy: Add progressive delivery workflow after image push.
6. Database Persistence: Replace InMemory with a persistent store behind feature toggle.
7. Extended Monitoring: Push structured logs and metrics to central system (e.g., Prometheus, OpenTelemetry).

## Troubleshooting
| Issue | Symptom | Resolution |
|-------|---------|------------|
| OIDC secrets missing | Build fails with configuration exception | Run with `disableOidc=true` or set secrets in repo/environment. |
| Smoke test fails | `/WeatherForecast` 500/timeout | Check `smoke.log` artifact; verify migrations/ports. |
| Coverage missing | No XML in artifacts | Ensure test project references `coverlet.collector` and not trimmed by filter. |
| Image not pushed | No tags in GHCR | Confirm permissions and that `runTestsOnly` not set. |

## Acceptance Criteria Mapping
- Automated pipeline: Provided via GitHub Actions workflow.
- Automated validation: Unit tests + coverage executed every run.
- Logs & test results archived: Artifacts + Action logs configured.
- Reproducible, isolated environment: Docker multi-stage image.
- Configurable schedule: Cron + manual inputs documented.

---
Maintainer: System Administration Team
Last Updated: {{DATE}}
