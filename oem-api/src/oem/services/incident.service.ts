import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateIncidentDto, UpdateIncidentDto } from '../dto';
import { IncidentSeverity, IncidentStatus } from '../domain';
import { IncidentEntity } from '../persistence/incident.entity';
import { IncidentTypeService } from './incident-type.service';
import { OperationPlanEntity } from '../persistence/operation-plan.entity';

@Injectable()
export class IncidentService {
  constructor(
    @InjectRepository(IncidentEntity)
    private readonly repo: Repository<IncidentEntity>,
    @InjectRepository(OperationPlanEntity)
    private readonly planRepo: Repository<OperationPlanEntity>,
    private readonly incidentTypes: IncidentTypeService,
  ) {}

  findAll(): Promise<IncidentEntity[]> {
    return this.repo.find({ order: { occurredAt: 'DESC' } });
  }

  async findOne(id: string): Promise<IncidentEntity> {
    const incident = await this.repo.findOne({ where: { id } });
    if (!incident) {
      throw new NotFoundException(`Incident ${id} not found`);
    }
    return incident;
  }

  async createIncident(dto: CreateIncidentDto): Promise<IncidentEntity> {
    await this.incidentTypes.findOne(dto.typeId);

    if (dto.operationPlanId) {
      await this.ensureOperationPlan(dto.operationPlanId);
    }

    const entity = this.repo.create({
      typeId: dto.typeId,
      title: dto.title,
      description: dto.description,
      operationPlanId: dto.operationPlanId,
      status: dto.status ?? IncidentStatus.Open,
      severity: dto.severity ?? IncidentSeverity.Low,
      occurredAt: new Date(dto.occurredAt),
      resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : undefined,
    });
    return this.repo.save(entity);
  }

  async updateIncident(id: string, dto: UpdateIncidentDto): Promise<IncidentEntity> {
    const existing = await this.findOne(id);

    if (dto.typeId) {
      await this.incidentTypes.findOne(dto.typeId);
    }

    if (dto.operationPlanId) {
      await this.ensureOperationPlan(dto.operationPlanId);
    }

    const merged = this.repo.merge(existing, {
      ...dto,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : existing.occurredAt,
      resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : existing.resolvedAt,
    });
    return this.repo.save(merged);
  }

  async remove(id: string): Promise<IncidentEntity> {
    const existing = await this.findOne(id);
    await this.repo.remove(existing);
    return existing;
  }

  private async ensureOperationPlan(operationPlanId: string): Promise<void> {
    const exists = await this.planRepo.exist({ where: { id: operationPlanId } });
    if (!exists) {
      throw new NotFoundException(`Operation plan ${operationPlanId} not found`);
    }
  }
}
