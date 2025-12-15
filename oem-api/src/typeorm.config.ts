import { DataSource } from 'typeorm';
import { OperationPlanEntity } from './oem/persistence/operation-plan.entity';
import { OperationPlanTaskEntity } from './oem/persistence/operation-plan-task.entity';
import { OperationPlanChangeLogEntity } from './oem/persistence/operation-plan-change-log.entity';
import { ComplementaryTaskEntity } from './oem/persistence/complementary-task.entity';
import { ComplementaryTaskCategoryEntity } from './oem/persistence/complementary-task-category.entity';
import { IncidentEntity } from './oem/persistence/incident.entity';
import { IncidentTypeEntity } from './oem/persistence/incident-type.entity';
import { VesselVisitExecutionEntity } from './oem/persistence/vessel-visit-execution.entity';
import { OemVvn } from './oem/vvn/oem-vvn.entity';

export default new DataSource({
  type: 'sqlite',
  database: process.env.DATABASE_PATH || 'oem.db',
  entities: [
    OperationPlanEntity,
    OperationPlanTaskEntity,
    OperationPlanChangeLogEntity,
    ComplementaryTaskEntity,
    ComplementaryTaskCategoryEntity,
    IncidentEntity,
    IncidentTypeEntity,
    VesselVisitExecutionEntity,
    OemVvn,
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: false,
});
