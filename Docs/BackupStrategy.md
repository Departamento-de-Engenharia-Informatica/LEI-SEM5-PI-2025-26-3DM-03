# Backup & Recovery Strategy (User Story: System Administrator – RPO/WRT)

Este documento propõe, justifica e descreve a implementação de uma estratégia de backup e recuperação para o sistema (TodoApi + Frontend Angular + dados de produção) com foco em minimizar:

- **RPO (Recovery Point Objective)**: Quanto de dados podemos perder (tempo máximo entre último backup consistente e falha).
- **WRT (Work Recovery Time)**: Tempo para voltar a ter o sistema operacional e pronto para trabalho normal (subset de RTO incluindo tarefas pós‐restore: validações, reindexações, apontar DNS, etc.).

> Nota: Assumimos que em produção haverá uma base de dados persistente (ex.: PostgreSQL ou SQL Server) e não o provider InMemory usado em dev. Ajustar comandos conforme o SGBD real escolhido.

---
## 1. Inventário de Ativos

| Categoria | Exemplos | Criticidade | Observações |
|-----------|----------|-------------|-------------|
| Dados transacionais | Registos de operações portuárias, utilizadores, permissões | Alta | Principal alvo dos backups (DB) |
| Configuração aplicação | appsettings (não secretos) | Média | Versionada em Git + incluída nos artefactos |
| Segredos / credenciais | Tokens OIDC, connection strings | Alta | Não são guardados em backups; mantidos em GitHub Secrets / Key Vault |
| Código fonte | .NET / Angular | Média | Protegido por Git (não precisa backup extra) |
| Artefactos build | Docker image, bundles Angular | Baixa | Regeráveis; somente cache opcional |
| Ficheiros estáticos | Assets, docs | Baixa | Em Git; sem necessidade de backup dedicado |

---
## 2. Objetivos (Propostos)

- **RPO alvo:** ≤ 15 minutos.
  - Justificação: Operações portuárias não devem perder mais do que alguns registos recentes; 15 min é aceitável sem custo excessivo.
  - Implementação: WAL/transaction log shipping (PostgreSQL: `pg_wal` / SQL Server: log backups) para off-site de 15 em 15 min.
- **WRT alvo:** ≤ 30 minutos para restaurar serviço totalmente funcional após declaração de incidente.
  - Justificação: Necessidade de retomar planeamento de recursos e movimentações rapidamente; infra automatizada via container + script de restore.
- (Opcional) **RTO global:** ≤ 45 minutos (inclui deteção + decisão + WRT).

---
## 3. Estratégia de Backup

### 3.1 Tipos
1. **Full Backup Diário (no horário de menor movimento, ex.: 02:00 UTC)**
2. **Incrementais/WAL logs a cada 15 minutos** para reduzir RPO.
3. **Snapshot Mensal** (cópia completa encriptada armazenada em deep storage) para retenção longa.

### 3.2 Frequências
| Tipo | Frequência | Retenção | Objetivo |
|------|------------|----------|----------|
| Full | 1x por dia (02:00 UTC) | 30 dias | Base para cadeias de restore |
| Incremental / log | 15 min (controlado por variável `ENABLE_INCREMENTAL`) | 7 dias | Reduz RPO sem armazenar dados excessivos |
| Mensal | 1x mês | 12 meses | Auditoria / rollback longo prazo |

### 3.3 Localizações de Armazenamento
| Local | Uso | Justificação |
|-------|-----|--------------|
| On-site (volume montado) | staging temporário de backups antes do upload | Velocidade local |
| Off-site primário (ex.: Azure Blob / S3) | Armazenamento principal encriptado | Resiliência a falhas de datacenter |
| Off-site secundário (ex.: outra região) | Replicação mensal | Proteção contra desastre regional |

### 3.4 Segurança
- **Encriptação em repouso:** Usar storage com Server-Side Encryption + opcional chave gerida (KMS / Key Vault).
- **Encriptação em trânsito:** Upload via HTTPS.
- **Integridade:** Calcular checksum SHA256 por ficheiro (`.sha256` pareado) e validar na restauração.
- **Least privilege:** Service account dedicada só com permissão de `write` na pasta/contêiner de backups.

### 3.5 Nomeação de Ficheiros
```
db-full-YYYYMMDD.sql.gz
db-inc-YYYYMMDD-HHMM-WAL.tar.gz
db-monthly-YYYYMM.tar.gz
checksums-YYYYMMDD.json
manifest-YYYYMMDD-HHMM.json
```

`manifest` contém: tipo, timestamp UTC, origem (hostname/container id), tamanho, algoritmos de hash.

> Nota de implementação (CI): no workflow GitHub Actions incluído, o "incremental" é realizado como um snapshot lógico frequente (pg_dump) para simplicidade operacional e validação automática. Em produção, recomenda-se trocar este passo por WAL/log shipping nativo do SGBD para maior eficiência; os scripts suportam esta evolução sem alterar RPO/WRT alvo.

Ativação de incrementais no repositório: definir a variável de repositório `ENABLE_INCREMENTAL` como `true` em Settings → Secrets and variables → Variables. O workflow `.github/workflows/backup-incremental.yml` corre a cada 15 minutos apenas quando esta variável estiver ativa.

---
## 4. Procedimentos

### 4.1 Backup (Diário Full) – Pseudopassos
1. Pausar tarefas não críticas (ex.: batch analytics) se existirem.
2. Executar `pg_dump --format=custom` (ou equivalente SQL Server `BACKUP DATABASE`).
3. Comprimir (`gzip` nível 6). Gerar checksum.
4. Upload para off-site (Blob/S3) com chave temporária.
5. Registar no `manifest` e enviar evento (ex.: Slack / email). Limpar ficheiros temporários.

### 4.2 Incremental / Log
1. Capturar WAL / transaction log gerado desde último envio.
2. Comprimir + checksum.
3. Upload; atualizar chain index (lista ordenada de logs entre full e agora).

### 4.3 Restore (Full + Incrementais)
1. Selecionar último full anterior ao incidente.
2. Descarregar full + todos os incrementais até ao momento imediatamente antes da falha.
3. Validar checksums.
4. Restaurar base (`pg_restore` / `RESTORE DATABASE`).
5. Aplicar logs incrementais (replay WAL / log backups) até ponto desejado.
6. Executar migrações (se nova versão do app) e testes de sanidade:
   - Contagem de registos críticos.
   - Integridade de chaves estrangeiras.
   - Endpoint `/health` responde 200.
7. Switch tráfego (atualizar DNS / load balancer). Remover modo manutenção.

### 4.4 Test Recovery Run (Semanal – CI) / Trimestral – Operacional
1. Simular falha: escolhe backup de data conhecida.
2. Restaurar em ambiente isolado (namespace `recovery-test`).
3. Executar script de validação.
4. Medir tempos: início → app saudável = WRT real. Igual comparar RPO efetivo = (timestamp incidente simulado - último ponto recuperado).
5. Documentar diferenças e ajustar frequências se necessário.

No CI, o workflow `.github/workflows/backup-verify.yml` executa semanalmente um ciclo de backup e restore em Postgres efémero e publica evidências como artefactos.

---
## 5. Métricas & Monitorização
| Métrica | Fonte | Alerta |
|---------|-------|--------|
| Tempo full backup | workflow logs | > 15 min |
| Duração upload | workflow logs | > 10 min |
| Falhas checksum | restore test script | qualquer falha = crítico |
| RPO real | compare timestamps | > alvo 15 min |
| WRT real | recovery test | > alvo 30 min |

Alerta via GitHub Actions + webhook para canal (Teams/Slack). Retentativa automática para uploads falhados (até 3 tentativas exponenciais).

---
## 6. Automação Proposta

### 6.1 Scripts (a criar)
- `scripts/backup-db.ps1` (Windows dev) / `scripts/backup-db.sh` (CI Linux) com parâmetros: `--type full|incremental --out <dir>`.
- `scripts/restore-db.sh` (ambiente de teste) para automatizar cadeia.

### 6.2 Workflow GitHub Actions (Novo)
Arquivo: `.github/workflows/backup.yml` (agendado)
Jobs:
1. `full-backup` (cron diário) -> executa script, publica artefato + upload S3/Blob.
2. `incremental-backup` (cron `*/15 * * * *`) -> apenas logs.
3. `verify-latest` (diário após full) -> restaura num container ephemeral, corre script de sanidade, publica resultado.

Secrets necessários:
- `DB_CONNECTION` (string de conexão)
- `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`
- `BACKUP_BUCKET` / `BACKUP_CONTAINER`

---
## 7. Justificação Técnica
- Full diário balanceia velocidade de restore (1 ficheiro grande) com custo de armazenamento.
- Incrementais curtos (log shipping) garantem RPO baixo sem repetir dump completo.
- Mensal longo prazo para auditoria e proteção contra corrupção lenta.
- Separação de segredos evita exposição em dumps.
- Checksums e test recovery detectam corrupção precoce.

---
## 8. Riscos & Mitigações
| Risco | Mitigação |
|-------|-----------|
| Crescimento rápido dos logs | Política rotação + compressão + monitorização tamanho |
| Falha no upload | Retentativas com backoff + alerta |
| Corrupção silenciosa | Test restore trimestral + checksums |
| Credenciais comprometidas | Rotação periódica + least privilege |
| Custo armazenamento | Lifecycle rules (expirar incrementais > 7 dias) |

---
## 9. Próximos Passos
1. Confirmar SGBD de produção (PostgreSQL vs SQL Server).
2. Implementar scripts base.
3. Criar workflow `backup.yml`.
4. Configurar storage e secrets.
5. Executar primeiro full + restore de validação.
6. Agendar test recovery trimestral.

---
## 10. Resumo dos Objetivos Alvo
| Objetivo | Valor | Estado |
|----------|-------|--------|
| RPO | ≤ 15 min | Atingível com incrementais 15 min |
| WRT | ≤ 30 min | Atingível via automação + container restore |
| Test restore | 1x / trimestre | Planeado |
| Retenção full | 30 dias | Planeado |
| Retenção inc | 7 dias | Planeado |
| Retenção mensal | 12 meses | Planeado |

---
## 11. Apêndice: Comandos (Exemplo PostgreSQL)
```bash
# Full
pg_dump -Fc -d "$DB_CONNECTION" -f backup/db-full-$(date +%Y%m%d).dump
gzip backup/db-full-$(date +%Y%m%d).dump
sha256sum backup/db-full-$(date +%Y%m%d).dump.gz > backup/db-full-$(date +%Y%m%d).sha256

# Incremental (envio WAL já arquivado)
tar -czf backup/db-inc-$(date +%Y%m%d-%H%M)-wal.tar.gz $PGDATA/pg_wal/*
sha256sum backup/db-inc-$(date +%Y%m%d-%H%M)-wal.tar.gz > backup/db-inc-$(date +%Y%m%d-%H%M)-wal.sha256

# Restore (simplificado)
pg_restore -d target_db backup/db-full-YYYYMMDD.dump
# Aplicar WAL conforme ferramentas (replay automático ao iniciar com arquivos em pg_wal)
```

---
### Ajustes Futuramente
- Introduzir incremental “differential” semanal para acelerar restore de cadeias longas.
- Adicionar catálogo interno dos manifests (tabela `backup_catalog`).
- Integração com métricas Prometheus (tempo últimas execuções, bytes transferidos).

---
_Documento inicial – sujeito a revisão após confirmação do SGBD de produção._
