# Roles e Permissões (RBAC)

Legenda de ações:

- `C` – Create
- `R` – Read/List
- `U` – Update
- `D` – Deactivate/Delete (quando aplicável)
- `A` – Approvar/Rejeitar
- `X` – Permissão total no módulo

## Port Authority Officer – Gestão de ativos e VVN

| Funcionalidade | Permissões |
| --- | --- |
| Vessel Types | C / R / U |
| Vessels | C / R / U |
| Docks | C / R / U |
| Storage Areas | C / R / U |
| Shipping Agent Organizations | C / R |
| Shipping Agent Representatives | C / R / U / D |
| Aprovar / Rejeitar Vessel Visit Notifications | A |

## Shipping Agent Representative – Vessel Visit Notifications

| Funcionalidade | Permissões |
| --- | --- |
| Criar VVN | C |
| Editar VVN (enquanto estiver “in progress”) | U |
| Submeter VVN | A (Submit) |
| Ver estado das VVN do seu agente | R |

## Logistics Operator – Staff, Resources e Scheduling

| Funcionalidade | Permissões |
| --- | --- |
| Criar/Editar/Desativar Staff Members | C / R / U / D |
| Criar/Editar/Desativar Resources | C / R / U / D |
| Criar/Editar Qualifications | C / R / U |
| Ver recursos, staff e qualificações | R |
| Executar algoritmo de Scheduling (ótimo/alternativo) | X |
| Ver resultados do Scheduling | R |

## System User – Acesso mínimo (novo)

Todos os utilizadores autenticados que tenham apenas o role `SystemUser` recebem:

- Acesso ao layout básico da SPA e aos menus correspondentes ao próprio role.
- Autenticação via IAM e manutenção da sessão.
- Acesso à pasta pública e à lista de recursos partilhados (read-only).
- Acesso ao 3D viewer e às vistas públicas (read-only).
- Zero permissões administrativas ou de modificação de dados.

## Versão resumida por role

| Role | Descrição |
| --- | --- |
| PortAuthorityOfficer | Gestão de port assets (vessels, docks, storage, organizações e representantes) + aprovação de VVN. |
| ShippingAgentRepresentative | Preparação, edição e submissão de VVN + acompanhamento do estado das submissões. |
| LogisticsOperator | Gestão de staff/resources/qualificações e execução do algoritmo de scheduling. |
| SystemUser | Utilizador autenticado com privilégios mínimos (navegação, vistas públicas e download dos recursos partilhados). |
