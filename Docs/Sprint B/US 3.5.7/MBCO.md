# Minimum Business Continuity Objective (MBCO)
### Port Operations Management System
### Prepared by: System Administrator  
### Version: 1.0
---

## 1. Purpose
This document defines the Minimum Business Continuity Objective (MBCO) for the Port Operations Management System. It establishes:
- Maximum acceptable downtime for each critical function.
- Minimum acceptable service capacity (performance, data freshness, degraded modes) during incidents.
- Alignment with the Risk Assessment (US 3.5.6) and available backup/recovery capabilities.
- A proposal to be reviewed and approved by project stakeholders.

---

## 2. Scope
The MBCO applies to the platform as a whole, covering:
- User authentication & authorization.
- Operational data domains (vessels, docks, storage, resources, staff, agents, representatives).
- Workflow processing (e.g., vessel visit notifications, task queues).
- Frontend availability (Angular SPA) and administrative tooling.

Non-critical utilities (dashboards, analytics, long-term reporting) may follow relaxed thresholds provided they do not impact Tier‑1/Tier‑2 functions.

---

## 3. Assumptions & Constraints
1. Production deployment consists of a .NET API layer, a relational database, and an Angular SPA fronted by HTTPS + CDN cache.
2. Authentication relies on an external IdP (e.g., Google OIDC) plus local role mapping.
3. Monitoring/alerting is available for API health, database replication, and infrastructure metrics.
4. Recovery assets: automated IaC redeploy, database backups ≥ every 6 hours, log-based recovery, documented manual workarounds.
5. Network/infrastructure incidents are possible (data center outage, ISP issues, certificate invalidation).

---

## 4. MBCO Metrics & Service Levels

### 4.1 Global Targets
- **Maximum total unplanned downtime per month**: 4 hours.
- **Maximum consecutive outage (per incident)**: 2 hours.
- **Recovery Time Objective (RTO)**: 2 hours.
- **Recovery Point Objective (RPO)**: 6 hours.
- **Minimum logging availability** during incidents: critical error logging ≥ 90%.

### 4.2 Function-Level Thresholds

| Service Area | Normal Operation | Minimum Acceptable Capacity (MBCO) | Max Downtime | Degraded Mode Notes |
| --- | --- | --- | --- | --- |
| Authentication & Authorization | 100% of users authenticate via IdP | At least one privileged account accessible; cached sessions remain valid | 30 min | Manual admin login or emergency token provision. |
| Mission-critical workflows (e.g., vessel visit notifications, berth scheduling) | Real-time workflow, sub-second responses | ≥ 70% throughput, latency ≤ 2x baseline, data lag ≤ 15 min | 30 min | Queue requests, prioritize high severity workloads. |
| Operational data CRUD (vessels, docks, storage areas, resources, staff) | Full read/write | Read-only within 10s responses; writes can be deferred ≤ 4h | 4 h | Batch operations or manual forms to capture updates. |
| Partner registries (agents, representatives) | Full CRUD | Read access with stale data ≤ 60 min; writes batched | 4 h | Manual spreadsheet capture acceptable. |
| Frontend SPA & dashboards | Available 24/7 | Static assets served from CDN; maintenance banner allowed | 1 h | API failures must be surfaced gracefully. |
| Reporting / analytics | On-demand exports and charts | Delivery may be postponed ≤ 24h | 24 h | Notify consumers of delay. |

### 4.3 Performance & Data Quality
- p95 API latency must not exceed 800ms for Tier‑1 endpoints under degraded mode; Tier‑2 ≤ 1.5s.
- Data integrity checks remain enforced even when queuing writes.
- Error budgets include user-facing messaging for partial functionality.

---

## 5. Alignment With Risk Assessment
| Risk (US 3.5.6) | Impact on MBCO | Mitigation / Requirement |
| --- | --- | --- |
| InMemory DB / data loss | RPO limited to 6h assumes persistent DB + backups | Implement scheduled backups, disable InMemory provider outside dev. |
| Single API instance outage | Drives RTO 2h, MCD 30 min for Tier‑1 | Add redundant instances + health checks + auto-restart scripts. |
| Identity provider dependency | Auth downtime limited to 30 min | Provide local admin fallback and pre-issued break-glass tokens. |
| Security/validation gaps | Data quality must not be compromised | Maintain validation pipeline even in degraded mode; reject corrupt data. |
| Monitoring gaps | Without visibility RTO cannot be met | Implement alerting, runbooks, and on-call escalation procedures. |

---

## 6. Backup & Recovery Capabilities

| Capability | Target Configuration | Supports MBCO |
| --- | --- | --- |
| Database Backups | Full every 6h, diff/log every hour; tested restores monthly | RPO compliance |
| Infrastructure as Code | Reproducible deploy in < 60 min | RTO compliance |
| Warm Standby / Autoscaling | At least 2 API instances per environment | Capacity ≥70% during failure |
| CDN/Static Cache | SPA available even if origin offline | Frontend availability |
| Monitoring & Alerting | 24/7 alerting on health endpoint, latency, errors | Early detection |
| Manual Workarounds | Paper or spreadsheet procedures for Tier‑1 workflows | Degraded operations continuity |

---

## 7. Degradation Strategies
1. **Read-only mode**: enforce for CRUD services when database write path unstable; surface banners to users.
2. **Queued writes / retry worker**: accept user input, persist to queue, replay once DB recovers.
3. **Role-based restriction**: allow only admins/authorities to access sensitive functions during incident.
4. **Graceful frontend messaging**: SPA must show maintenance/incident state, not blank errors.
5. **Manual SOP activation**: Harbor master logs vessel updates manually; support staff synchronizes once restored.

---

## 8. Stakeholder Review & Approval

| Stakeholder | Role | Responsibility | Status |
| --- | --- | --- | --- |
| System Administrator | Author | Drafts MBCO, validates technical feasibility | ✅ Draft complete |
| Product Owner | Business | Confirms downtime/capacity acceptable | ☐ Pending |
| Security / Compliance Officer | Governance | Validates alignment with risk posture | ☐ Pending |
| Development Lead | Engineering | Confirms mitigations implementable | ☐ Pending |
| Operations / DevOps Lead | Infrastructure | Confirms backup/recovery readiness | ☐ Pending |

Approval will be recorded in the project change log and appended to the Business Continuity Plan. Review cadence: semiannual or upon major architectural change.

---

## 9. Conclusion
The defined MBCO provides measurable continuity targets, ties them to known risks, and outlines the capabilities required to sustain the Port Operations Management System during incidents. Once approved by stakeholders, this document becomes the baseline for:
- Architecture and capacity planning.
- Backup/recovery implementations.
- Monitoring and incident response playbooks.
- Future scalability and compliance audits.

Maintaining adherence to the MBCO ensures that critical port operations experience minimal disruption even under adverse conditions.
