import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateVesselVisitExecutionDto, UpdateVesselVisitExecutionDto } from '../dto';
import { VesselExecutionStatus } from '../domain';
import { OperationPlanEntity } from '../persistence/operation-plan.entity';
import { VesselVisitExecutionEntity } from '../persistence/vessel-visit-execution.entity';

@Injectable()
export class VesselVisitExecutionService {
  constructor(
    @InjectRepository(VesselVisitExecutionEntity)
    private readonly repo: Repository<VesselVisitExecutionEntity>,
    @InjectRepository(OperationPlanEntity)
    private readonly planRepo: Repository<OperationPlanEntity>,
  ) {}

  findAll(): Promise<VesselVisitExecutionEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<VesselVisitExecutionEntity> {
    const execution = await this.repo.findOne({ where: { id } });
    if (!execution) {
      throw new NotFoundException(`Vessel visit execution ${id} not found`);
    }
    return execution;
  }

  async createExecution(
    dto: CreateVesselVisitExecutionDto,
  ): Promise<VesselVisitExecutionEntity> {
    if (dto.operationPlanId) {
      await this.ensureOperationPlan(dto.operationPlanId);
    }

    const entity = this.repo.create({
      vesselName: dto.vesselName,
      voyageNumber: dto.voyageNumber,
      operationPlanId: dto.operationPlanId,
      eta: dto.eta ? new Date(dto.eta) : undefined,
      etd: dto.etd ? new Date(dto.etd) : undefined,
      status: dto.status ?? VesselExecutionStatus.Pending,
    });
    return this.repo.save(entity);
  }

  async updateExecution(
    id: number,
    dto: UpdateVesselVisitExecutionDto,
  ): Promise<VesselVisitExecutionEntity> {
    const existing = await this.findOne(id);

    if (dto.operationPlanId) {
      await this.ensureOperationPlan(dto.operationPlanId);
    }

    const merged = this.repo.merge(existing, {
      ...dto,
      eta: dto.eta ? new Date(dto.eta) : existing.eta,
      etd: dto.etd ? new Date(dto.etd) : existing.etd,
    });
    return this.repo.save(merged);
  }

  async remove(id: number): Promise<VesselVisitExecutionEntity> {
    const existing = await this.findOne(id);
    await this.repo.remove(existing);
    return existing;
  }

  private async ensureOperationPlan(operationPlanId: number): Promise<void> {
    const exists = await this.planRepo.exist({ where: { id: operationPlanId } });
    if (!exists) {
      throw new NotFoundException(`Operation plan ${operationPlanId} not found`);
    }
  }
}
