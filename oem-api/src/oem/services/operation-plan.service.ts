import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { Repository } from 'typeorm';
import { CreateOperationPlanDto, GenerateOperationPlansDto, UpdateOperationPlanDto } from '../dto';
import { OperationPlanStatus } from '../domain';
import { OperationPlanEntity } from '../persistence/operation-plan.entity';
import { ExternalClientsService, VesselVisitNotification } from './external-clients.service';

@Injectable()
export class OperationPlanService {
  constructor(
    @InjectRepository(OperationPlanEntity)
    private readonly repo: Repository<OperationPlanEntity>,
    private readonly externalClients: ExternalClientsService,
  ) {}

  async findAll(): Promise<OperationPlanEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<OperationPlanEntity> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) {
      throw new NotFoundException(`Operation plan ${id} not found`);
    }
    return found;
  }

  async createPlan(dto: CreateOperationPlanDto): Promise<OperationPlanEntity> {
    const entity = this.repo.create({
      name: dto.name,
      description: dto.description,
      vesselVisitId: dto.vesselVisitId,
      sourceVvnId: dto.sourceVvnId,
      shiftDate: dto.shiftDate ? new Date(dto.shiftDate) : undefined,
      targetDay: dto.targetDay ? new Date(dto.targetDay) : undefined,
      algorithmUsed: dto.algorithmUsed,
      createdBy: dto.createdBy,
      operations: dto.operations?.map((op) => ({
        ...op,
        startTime: op.startTime ? new Date(op.startTime) : undefined,
        endTime: op.endTime ? new Date(op.endTime) : undefined,
      })),
      status: dto.status ?? OperationPlanStatus.Draft,
    });
    return this.repo.save(entity);
  }

  async updatePlan(id: string, dto: UpdateOperationPlanDto): Promise<OperationPlanEntity> {
    const existing = await this.findOne(id);
    const merged = this.repo.merge(existing, {
      ...dto,
      shiftDate: dto.shiftDate ? new Date(dto.shiftDate) : existing.shiftDate,
      targetDay: dto.targetDay ? new Date(dto.targetDay) : existing.targetDay,
      operations: dto.operations
        ? dto.operations.map((op) => ({
            ...op,
            startTime: op.startTime ? new Date(op.startTime) : undefined,
            endTime: op.endTime ? new Date(op.endTime) : undefined,
          }))
        : existing.operations,
    });
    return this.repo.save(merged);
  }

  async remove(id: string): Promise<OperationPlanEntity> {
    const existing = await this.findOne(id);
    await this.repo.remove(existing);
    return existing;
  }

  async generateForDay(
    dto: GenerateOperationPlansDto,
    createdBy?: string,
  ): Promise<OperationPlanEntity[]> {
    const targetDayIso = dto.targetDay;
    let vvns: VesselVisitNotification[] = [];

    try {
      const resp = (await firstValueFrom(
        this.externalClients.fetchVvnsForDay(targetDayIso),
      )) as AxiosResponse<VesselVisitNotification[]>;
      vvns = resp.data ?? [];
    } catch (err) {
      vvns = [];
    }

    if (!vvns.length) {
      return [];
    }

    const generated = await Promise.all(
      vvns.map(async (vvn, index) => {
        const draft: CreateOperationPlanDto = {
          name: `Plan for VVN ${vvn.id}`,
          description: `Auto-generated plan for VVN ${vvn.id} on ${targetDayIso}`,
          vesselVisitId: vvn.vesselVisitId ?? vvn.id,
          sourceVvnId: vvn.id,
          targetDay: dto.targetDay,
          shiftDate: vvn.eta ?? targetDayIso,
          algorithmUsed: dto.algorithm,
          createdBy,
          operations: [
            {
              resourceId: vvn.berth,
              resourceType: 'berth',
              operationType: 'other',
              startTime: vvn.eta,
              endTime: vvn.etd,
            },
          ],
          status: OperationPlanStatus.Draft,
        };

        if (dto.save) {
          return this.createPlan(draft);
        }

        return {
          id: `preview-${index + 1}`,
          createdAt: new Date(),
          ...draft,
          shiftDate: draft.shiftDate ? new Date(draft.shiftDate) : undefined,
          targetDay: draft.targetDay ? new Date(draft.targetDay) : undefined,
        } as unknown as OperationPlanEntity;
      }),
    );

    return generated;
  }
}
