import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import { OemController } from './oem.controller';
import { OemService } from './oem.service';
import {
  ComplementaryTaskCategoryController,
  ComplementaryTaskController,
  DevSeedController,
  IncidentController,
  IncidentTypeController,
  OperationPlanController,
  VesselVisitExecutionController,
} from './controllers';
import { IamAuthGuard, RolesGuard } from './auth';
import {
  ComplementaryTaskCategoryService,
  ComplementaryTaskService,
  IncidentService,
  IncidentTypeService,
  OperationPlanService,
  ExternalClientsService,
  VesselVisitExecutionService,
} from './services';
import { OemSeedService } from './seed/oem-seed.service';
import { OperationPlanEntity } from './persistence/operation-plan.entity';
import { ComplementaryTaskCategoryEntity } from './persistence/complementary-task-category.entity';
import { ComplementaryTaskEntity } from './persistence/complementary-task.entity';
import { ComplementaryTaskAuditEntity } from './persistence/complementary-task-audit.entity';
import { IncidentTypeEntity } from './persistence/incident-type.entity';
import { IncidentEntity } from './persistence/incident.entity';
import { IncidentAffectedVveEntity } from './persistence/incident-affected-vve.entity';
import { IncidentAuditEntity } from './persistence/incident-audit.entity';
import { VesselVisitExecutionEntity } from './persistence/vessel-visit-execution.entity';
import { OemVvn } from './vvn/oem-vvn.entity';
import { OemVvnService } from './vvn/oem-vvn.service';
import { OperationPlanTaskEntity } from './persistence/operation-plan-task.entity';
import { OperationPlanChangeLogEntity } from './persistence/operation-plan-change-log.entity';
import { MissingOperationPlansService } from './services';
import { VesselVisitExecutionAuditEntity } from './persistence/vessel-visit-execution-audit.entity';
import { ExecutedOperationEntity } from './persistence/executed-operation.entity';
import { ExecutedOperationAuditEntity } from './persistence/executed-operation-audit.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      OperationPlanEntity,
      ComplementaryTaskCategoryEntity,
      ComplementaryTaskEntity,
      ComplementaryTaskAuditEntity,
      IncidentTypeEntity,
      IncidentEntity,
      IncidentAffectedVveEntity,
      IncidentAuditEntity,
      VesselVisitExecutionEntity,
      VesselVisitExecutionAuditEntity,
      OperationPlanTaskEntity,
      OperationPlanChangeLogEntity,
      ExecutedOperationEntity,
      ExecutedOperationAuditEntity,
      OemVvn,
    ]),
  ],
  controllers: [
    OemController,
    DevSeedController,
    OperationPlanController,
    VesselVisitExecutionController,
    IncidentController,
    IncidentTypeController,
    ComplementaryTaskController,
    ComplementaryTaskCategoryController,
  ],
  providers: [
    OemService,
    OperationPlanService,
    MissingOperationPlansService,
    VesselVisitExecutionService,
    IncidentService,
    IncidentTypeService,
    ComplementaryTaskService,
    ComplementaryTaskCategoryService,
    ExternalClientsService,
    OemSeedService,
    OemVvnService,
    IamAuthGuard,
    RolesGuard,
    Reflector,
  ],
  exports: [OemService],
})
export class OemModule {}
