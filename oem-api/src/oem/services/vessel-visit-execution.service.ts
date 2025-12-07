import { Injectable } from '@nestjs/common';
import { CreateVesselVisitExecutionDto, UpdateVesselVisitExecutionDto } from '../dto';
import { VesselExecutionStatus, VesselVisitExecution } from '../domain';
import { BaseInMemoryService } from './base-in-memory.service';

@Injectable()
export class VesselVisitExecutionService extends BaseInMemoryService<
  VesselVisitExecution,
  CreateVesselVisitExecutionDto,
  UpdateVesselVisitExecutionDto
> {
  createExecution(dto: CreateVesselVisitExecutionDto): VesselVisitExecution {
    return this.create(dto, (id, payload) => {
      return new VesselVisitExecution({
        id,
        createdAt: new Date(),
        vesselName: payload.vesselName,
        voyageNumber: payload.voyageNumber,
        operationPlanId: payload.operationPlanId,
        eta: payload.eta ? new Date(payload.eta) : undefined,
        etd: payload.etd ? new Date(payload.etd) : undefined,
        status: payload.status ?? VesselExecutionStatus.Pending,
      });
    });
  }

  updateExecution(id: string, dto: UpdateVesselVisitExecutionDto): VesselVisitExecution {
    return this.update(id, dto, (existing, payload) => {
      return new VesselVisitExecution({
        ...existing,
        ...payload,
        eta: payload.eta ? new Date(payload.eta) : existing.eta,
        etd: payload.etd ? new Date(payload.etd) : existing.etd,
      });
    });
  }
}
