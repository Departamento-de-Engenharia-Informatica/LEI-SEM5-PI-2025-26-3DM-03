# TodoApi Test Plan

## Objectives
- Validate that the `TodoApi` module behaves according to the functional requirements defined for Sprint 3.5 (vessel tracking, task management, and authentication).
- Provide a repeatable checklist that can be executed automatically in the CI/CD pipeline (`.github/workflows/deploy-todoapi.yml`) and manually when required.
- Capture evidence (logs, TRX, coverage) so deployments to the DEI environment are auditable.

## Scope
### In scope
1. **Domain rules** — entity validation, value object invariants, aggregate behavior (tested in `testes/Domain.Tests`).
2. **Application services** — commands/queries exposed through the Todo API, including vessel endpoints.
3. **API surface** — contract-level smoke check on `/WeatherForecast` + future health endpoints via container smoke test.
4. **Security toggles** — ability to run with `DISABLE_OIDC=true` in controlled environments.

### Out of scope (current release)
- Performance / load testing.
- UI / Angular frontend E2E flows (tracked separately in frontend test plan).
- Persistence-specific validations (database not wired yet).

## Test Environment Matrix
| Environment | Purpose | Trigger | Tooling |
|-------------|---------|---------|---------|
| `ci-dotnet` (GitHub Actions `build-test` job) | Run unit/coverage suite | Every push to `main`, manual dispatch, nightly schedule | `dotnet test testes/Domain.Tests/Domain.Tests.csproj` with Coverlet |
| `ci-container` (GitHub Actions `containerize` job) | Validate published Docker image boots and answers | After successful tests unless `runTestsOnly=true` | `docker run …` + `curl /WeatherForecast` |
| `dei` (optional deployment target) | Controlled VM/container for validation of release candidate | Manual workflow run with `deployToDei=true` | `appleboy/ssh-action` executing Docker lifecycle |

## Test Catalogue
| ID | Name | Type | Description | Automated? |
|----|------|------|-------------|------------|
| TC-DOM-001 | Vessel creation invariants | Unit | Ensures `Vessel` aggregate rejects invalid identifiers, IMO/MMSI formats, and missing dimensions. Implemented in `testes/Domain.Tests/VesselTests.cs`. | Yes (Domain.Tests) |
| TC-DOM-002 | Task scheduling rules | Unit | Confirms domain services prevent overlapping maintenance windows and enforce required crew roles. | Yes (Domain.Tests) |
| TC-API-001 | WeatherForecast smoke | API | Containerized API responds to GET `/WeatherForecast` within 10 s with HTTP 200. | Yes (container smoke test) |
| TC-API-002 | Vessel endpoints contract | API | (Placeholder) Validate CRUD/DTO mapping for vessels using integration test harness once persistence lands. | Planned |
| TC-SEC-001 | OIDC disabled bootstrap | Config | With `DISABLE_OIDC=true`, API boots without Google credentials and exposes anonymous endpoints. | Yes (container smoke test) |
| TC-SEC-002 | OIDC enabled happy-path | Config | Validate authentication flow against Google test credentials. | Pending external secrets |

## Execution & Reporting
1. Pipeline step **“Test (with coverage)”** executes all `Domain.Tests` cases, generates TRX + Cobertura reports, and publishes them as the `test-results` artifact (retained 30 days).
2. Pipeline step **“Smoke test container”** executes API smoke cases and uploads `smoke.log`.
3. Optional DEI deployment run replays container start-up logs in GitHub Actions output; operators attach manual test notes to the run if additional manual checks are performed.
4. For manual executions, use `dotnet test testes/Domain.Tests/Domain.Tests.csproj --logger "trx"` locally and store logs under `Docs/Testing/manual-runs/<date>` (folder ignored by Git).

## Exit Criteria
- All automated cases pass (no failed tests or smoke checks).
- Coverage report is generated (presence of `TestResults/coverage.cobertura.xml`).
- No blocking defects recorded in the Action run.
- For DEI deployments, container reports healthy status and optional manual checklist is completed.

## Maintenance
- Update this plan whenever new modules (e.g., persistence, authentication) add scenarios.
- Mirror each new unit/integration test with an entry in **Test Catalogue** so stakeholders know what is enforced automatically.
- Review coverage metrics quarterly to ensure critical paths remain under automated validation.
