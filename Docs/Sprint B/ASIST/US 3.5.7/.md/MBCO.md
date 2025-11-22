# Minimum Business Continuity Objective (MBCO)  
### Port Operations Management System  
### Prepared by: System Administrator  
### Version: 1.1  
---

## 1. Purpose
This document defines the Minimum Business Continuity Objective (MBCO) for the Port Operations Management System.  
It establishes measurable thresholds that determine:

- The maximum acceptable downtime per incident.
- The minimum acceptable service capacity during degraded operation.
- The expected system availability during business-critical periods.
- The alignment between operational continuity goals, the risk assessment (US 3.5.6), and the backup/recovery capabilities (US 3.5.8).

The MBCO must be reviewed and validated by project stakeholders before becoming the baseline for continuity planning.

---

## 2. Scope
The MBCO applies to all components deployed in the controlled DEI environment, including:

- Backend services supporting operational data (vessels, docks, storage areas, resources).
- The Angular SPA frontend accessed by authenticated users.
- Integration with the external IAM provider for authentication and authorization.
- Supporting infrastructure: database, logging services, and remote administration tools.

Critical services for continuity include authenticated access and the ability to consult or update operational information relevant to port activity.

---

## 3. Assumptions & Constraints
1. The system runs on Linux-based VMs using automated deployment pipelines.  
2. Authentication is handled by an external Identity Provider (OIDC), with local role-based authorization.  
3. Monitoring is available for backend health, VM resources, and authentication failures.  
4. Recovery mechanisms include database backups, VM snapshots, IaC redeploy, and documented manual procedures.  
5. Network or infrastructure outages (ISP issues, VM failure, certificate errors) are considered plausible.

---

## 4. MBCO Metrics & Service Levels

### 4.1 Global Continuity Targets
- **Maximum downtime per critical incident:** 2 hours  
- **Maximum consecutive outage:** 2 hours  
- **Minimum monthly availability during working hours:** 99%  
- **Minimum service capacity during degraded mode:** ≥ 60% of core functionality  
- **Minimum logging availability during incidents:** ≥ 90% of critical log entries preserved

These thresholds match the recovery capabilities supported by backups, monitoring, and automated redeployment.

---

## 4.2 Function-Level Continuity Thresholds

| Service Area | Normal Operation | Minimum Acceptable Capacity | Max Downtime | Degraded Mode Notes |
|--------------|------------------|------------------------------|--------------|----------------------|
| Authentication & Authorization | Full IdP-based authentication | Access via at least one privileged local account; cached sessions remain valid | 30 min | Emergency admin login enabled; fallback token allowed |
| Core operational workflows (vessel scheduling, notifications, resource management) | Real-time operation | ≥ 60% functionality; latency ≤ 2× baseline | 30 min | Non-essential tasks deferred; queueing permitted |
| Operational data CRUD | Full read/write | Read-only mode with responsive queries; writes deferred ≤ 4h | 4 h | Offline data capture permitted for later batching |
| Partner registries (agents, representatives) | Full CRUD | Read access within 1h data freshness | 4 h | Manual spreadsheets accepted temporarily |
| Frontend SPA | Fully available | Static assets served from CDN; degraded backend messaging allowed | 1 h | Maintenance banner displayed when API fails |
| Reporting & analytics | On-demand | Delivery may be postponed ≤ 24h | 24 h | Users notified of delay |

---

## 4.3 Performance & Data Quality Requirements
- Tier-1 operations (authentication, vessel operations) must maintain **p95 latency ≤ 800ms** under degraded mode.  
- Data written during degraded mode must remain consistent and validated.  
- Queued write operations must be replayed in order once service restores.

---

## 5. Alignment With Risk Assessment (US 3.5.6)

| Identified Risk | Impact on Continuity | MBCO Requirement |
|------------------|----------------------|-------------------|
| VM failure / deployment errors | Full outage | Supports the 2h maximum downtime limit by requiring automated rollback and redeploy |
| Data loss risk | Loss of operational records | Enforces RPO consistent with backup frequency and recovery testing |
| Unauthorized access / IAM failures | Loss of access to system | Allows fallback admin login and cached sessions |
| Monitoring gaps | Delayed detection of incidents | Requires active alerting to meet the RTO |
| Configuration errors | Service instability | Requires validation of config files and rapid rollback |

These align directly with the risks identified in US 3.5.6 :contentReference[oaicite:1]{index=1}.

---

## 6. Backup & Recovery Capabilities Supporting MBCO

| Capability | Target Configuration | Supports |
|-----------|----------------------|----------|
| Database backups | Full backup every 6h; restore tests monthly | RPO compliance |
| VM snapshots | Snapshot before each deployment | Reduces downtime after critical failure |
| Infrastructure as Code | Rebuild VM in < 60 min | Meets RTO |
| Redundant backend instances | Minimum 2 API instances | Maintains ≥60% capacity |
| CDN caching | SPA served even if backend down | Maintains user access |
| Manual fallback workflows | Paper or spreadsheet recording | Ensures operational continuity |

---

## 7. Degradation Strategies
1. **Read-only mode** for CRUD operations during database instability.  
2. **Queued writes & delayed persistence**, processed after recovery.  
3. **Role-restricted access** during partial outages (admin-only operations).  
4. **Clear frontend messaging**, avoiding blank screens or generic errors.  
5. **Manual fallback procedures** for vessel updates and operational logs.

---

## 8. Stakeholder Review & Approval

| Stakeholder | Role | Responsibility | Status |
|-------------|------|----------------|--------|
| System Administrator | Author | Drafts and validates technical feasibility | ✅ Completed |
| Product Owner | Business | Confirms business acceptability of continuity levels | ☐ Pending |
| Security/Compliance Officer | Governance | Ensures alignment with security posture | ☐ Pending |
| Development Lead | Engineering | Confirms implementation feasibility | ☐ Pending |
| Operations Lead | Infrastructure | Confirms recovery readiness | ☐ Pending |

Upon approval, the MBCO becomes the formal basis for the Business Continuity Plan and must be reviewed after major system changes.

---

## 9. Conclusion
The MBCO defined here establishes measurable continuity objectives that align with identified risks, recovery capabilities, and operational requirements.  
Once approved, it will guide:

- Incident response procedures  
- Backup and restore strategy (US 3.5.8)  
- Deployment and monitoring improvements  
- Compliance and operational audits  

Maintaining adherence to the MBCO ensures that critical port operations remain functional even under adverse conditions.

---