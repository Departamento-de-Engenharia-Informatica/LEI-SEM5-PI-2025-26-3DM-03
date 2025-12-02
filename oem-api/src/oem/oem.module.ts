import { Module } from '@nestjs/common';
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

@Module({
  controllers: [
    OemController,
    OperationPlanController,
    VesselVisitExecutionController,
    IncidentController,
    IncidentTypeController,
    ComplementaryTaskController,
    ComplementaryTaskCategoryController,
  ],
  providers: [OemService],
  exports: [OemService],
})
export class OemModule {}
