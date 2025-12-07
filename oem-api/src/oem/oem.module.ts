import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
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

@Module({
  imports: [HttpModule],
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
