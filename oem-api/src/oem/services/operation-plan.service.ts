import { Injectable } from '@nestjs/common';
import { CreateOperationPlanDto, UpdateOperationPlanDto } from '../dto';
import { OperationPlan, OperationPlanStatus } from '../domain';
import { BaseInMemoryService } from './base-in-memory.service';

@Injectable()
export class OperationPlanService extends BaseInMemoryService<
  OperationPlan,
  CreateOperationPlanDto,
  UpdateOperationPlanDto
> {
  createPlan(dto: CreateOperationPlanDto): OperationPlan {
    return this.create(dto, (id, payload) => {
      return new OperationPlan({
        id,
        createdAt: new Date(),
        name: payload.name,
        description: payload.description,
        vesselVisitId: payload.vesselVisitId,
        shiftDate: payload.shiftDate ? new Date(payload.shiftDate) : undefined,
        status: payload.status ?? OperationPlanStatus.Draft,
      });
    });
  }

  updatePlan(id: string, dto: UpdateOperationPlanDto): OperationPlan {
    return this.update(id, dto, (existing, payload) => {
      return new OperationPlan({
        ...existing,
        ...payload,
        shiftDate: payload.shiftDate ? new Date(payload.shiftDate) : existing.shiftDate,
      });
    });
  }
}
