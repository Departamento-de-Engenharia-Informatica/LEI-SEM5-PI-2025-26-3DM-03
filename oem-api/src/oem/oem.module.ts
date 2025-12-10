import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import { OemController } from './oem.controller';
import { OemService } from './oem.service';
import {
  ComplementaryTaskCategoryController,
  ComplementaryTaskController,
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
import { OperationPlanEntity } from './persistence/operation-plan.entity';
import { ComplementaryTaskCategoryEntity } from './persistence/complementary-task-category.entity';
import { ComplementaryTaskEntity } from './persistence/complementary-task.entity';
import { IncidentTypeEntity } from './persistence/incident-type.entity';
import { IncidentEntity } from './persistence/incident.entity';
import { VesselVisitExecutionEntity } from './persistence/vessel-visit-execution.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      OperationPlanEntity,
      ComplementaryTaskCategoryEntity,
      ComplementaryTaskEntity,
      IncidentTypeEntity,
      IncidentEntity,
      VesselVisitExecutionEntity,
    ]),
  ],
  controllers: [
    OemController,
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
    VesselVisitExecutionService,
    IncidentService,
    IncidentTypeService,
    ComplementaryTaskService,
    ComplementaryTaskCategoryService,
    ExternalClientsService,
    IamAuthGuard,
    RolesGuard,
    Reflector,
  ],
  exports: [OemService],
})
export class OemModule {}
