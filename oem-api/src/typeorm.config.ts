import { DataSource } from 'typeorm';
import { OperationPlanEntity } from './oem/persistence/operation-plan.entity';
import { OperationPlanTaskEntity } from './oem/persistence/operation-plan-task.entity';
import { OperationPlanChangeLogEntity } from './oem/persistence/operation-plan-change-log.entity';
import { ComplementaryTaskEntity } from './oem/persistence/complementary-task.entity';
import { ComplementaryTaskAuditEntity } from './oem/persistence/complementary-task-audit.entity';
import { ComplementaryTaskCategoryEntity } from './oem/persistence/complementary-task-category.entity';
import { IncidentEntity } from './oem/persistence/incident.entity';
import { IncidentAffectedVveEntity } from './oem/persistence/incident-affected-vve.entity';
import { IncidentAuditEntity } from './oem/persistence/incident-audit.entity';
import { IncidentTypeEntity } from './oem/persistence/incident-type.entity';
import { VesselVisitExecutionEntity } from './oem/persistence/vessel-visit-execution.entity';
import { VesselVisitExecutionAuditEntity } from './oem/persistence/vessel-visit-execution-audit.entity';
import { ExecutedOperationEntity } from './oem/persistence/executed-operation.entity';
import { ExecutedOperationAuditEntity } from './oem/persistence/executed-operation-audit.entity';
import { OemVvn } from './oem/vvn/oem-vvn.entity';

export default new DataSource({
  type: 'sqlite',
  database: process.env.DATABASE_PATH || 'oem.db',
  entities: [
    OperationPlanEntity,
    OperationPlanTaskEntity,
    OperationPlanChangeLogEntity,
    ComplementaryTaskEntity,
    ComplementaryTaskAuditEntity,
    ComplementaryTaskCategoryEntity,
    IncidentEntity,
    IncidentAffectedVveEntity,
    IncidentAuditEntity,
    IncidentTypeEntity,
    VesselVisitExecutionEntity,
    VesselVisitExecutionAuditEntity,
    ExecutedOperationEntity,
    ExecutedOperationAuditEntity,
    OemVvn,
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: false,
});
