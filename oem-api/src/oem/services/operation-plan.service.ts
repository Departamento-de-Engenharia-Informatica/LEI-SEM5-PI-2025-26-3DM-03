import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { Between, Repository } from 'typeorm';
import { CreateOperationPlanDto, GenerateOperationPlansDto, UpdateOperationPlanDto } from '../dto';
import { OperationPlanPreviewDto, OperationTaskPreviewDto } from '../operation-plans/dtos';
import { OperationPlanStatus } from '../domain';
import { OperationPlanEntity } from '../persistence/operation-plan.entity';
import { ExternalClientsService, VesselVisitNotification } from './external-clients.service';
import { OemVvnService } from '../vvn/oem-vvn.service';
import { OemVvn } from '../vvn/oem-vvn.entity';
import { OperationPlanTaskEntity } from '../persistence/operation-plan-task.entity';

@Injectable()
export class OperationPlanService {
  constructor(
    @InjectRepository(OperationPlanEntity)
    private readonly repo: Repository<OperationPlanEntity>,
    @InjectRepository(OperationPlanTaskEntity)
    private readonly taskRepo: Repository<OperationPlanTaskEntity>,
    private readonly externalClients: ExternalClientsService,
    private readonly vvnService: OemVvnService,
  ) {}

  async findAll(): Promise<OperationPlanEntity[]> {
    return this.repo.find({
      order: { createdAt: 'DESC' },
      relations: ['tasks'],
    });
  }

  async findOne(id: string): Promise<OperationPlanEntity> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) {
      throw new NotFoundException(`Operation plan ${id} not found`);
    }
    return found;
  }

  async generateAndPersistForDay(
    date: string,
    algorithm = 'fake-sequential',
    createdBy?: string,
  ): Promise<OperationPlanEntity[]> {
    const { start, end } = this.getDayRange(date);

    const exists = await this.repo.exist({
      where: { plannedStartTime: Between(start, end) },
    });

    if (exists) {
      throw new ConflictException(
        'Operation Plans for this day already exist. Use regeneration flow instead.',
      );
    }

    const previews = await this.generatePreviewForDay(date, algorithm);
    if (!previews.length) {
      return [];
    }

    const persisted = await this.repo.manager.transaction(async (entityManager) => {
      const planRepo = entityManager.getRepository(OperationPlanEntity);
      const taskRepo = entityManager.getRepository(OperationPlanTaskEntity);
      const createdPlans: OperationPlanEntity[] = [];

      for (const preview of previews) {
        const plan = planRepo.create({
          name: `Plan for ${preview.vesselName}`,
          description: `Automated schedule for VVN ${preview.vvnId} on ${date}`,
          vesselVisitId: preview.vvnId,
          sourceVvnId: preview.vvnId,
          dockId: preview.dockId,
          plannedStartTime: new Date(preview.plannedStartTime),
          plannedEndTime: new Date(preview.plannedEndTime),
          targetDay: start,
          algorithmUsed: preview.algorithmUsed ?? algorithm,
          status: OperationPlanStatus.Planned,
          createdBy: createdBy ?? 'system',
        });

        const savedPlan = await planRepo.save(plan);

        const taskEntities = preview.operations
          .filter((operation) => operation.startTime && operation.endTime)
          .map((operation) =>
            taskRepo.create({
              operationPlanId: savedPlan.id,
              type: operation.type,
              craneId: operation.craneId,
              storageAreaId: operation.storageAreaId,
              startTime: new Date(operation.startTime),
              endTime: new Date(operation.endTime),
            }),
          );

        if (taskEntities.length) {
          const persistedTasks = await taskRepo.save(taskEntities);
          savedPlan.tasks = persistedTasks;
        } else {
          savedPlan.tasks = [];
        }

        createdPlans.push(savedPlan);
      }

      return createdPlans;
    });

    return persisted.sort((a, b) => {
      const timeA = a.plannedStartTime?.getTime() ?? 0;
      const timeB = b.plannedStartTime?.getTime() ?? 0;
      return timeA - timeB;
    });
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

  async generatePreviewForDay(
    date: string,
    algorithm = 'fake-sequential',
  ): Promise<OperationPlanPreviewDto[]> {
    const vvns = await this.vvnService.getApprovedForDay(date);
    if (!vvns.length) {
      return [];
    }

    const grouped = this.groupByDock(vvns);
    const previews: OperationPlanPreviewDto[] = [];

    for (const [, dockVvns] of grouped) {
      dockVvns.sort((a, b) => a.eta.getTime() - b.eta.getTime());
      let currentDockTime = new Date(dockVvns[0].eta.getTime());

      for (const vvn of dockVvns) {
        const plannedStart = this.computePlannedStart(vvn.eta, currentDockTime);
        const durationMinutes = Math.max(vvn.containers, 0) * 2;
        const plannedEnd = new Date(plannedStart.getTime() + durationMinutes * 60_000);
        currentDockTime = new Date(plannedEnd.getTime());

        const expectedDelayMinutes = this.computeDelayMinutes(plannedEnd, vvn.etd);
        const operations = this.buildOperations(plannedStart, plannedEnd);

        previews.push({
          vvnId: vvn.id,
          vesselName: vvn.vesselName,
          dockId: vvn.dockId,
          plannedStartTime: plannedStart.toISOString(),
          plannedEndTime: plannedEnd.toISOString(),
          expectedDelayMinutes,
          algorithmUsed: algorithm,
          operations,
        });
      }
    }

    return previews.sort((a, b) => a.plannedStartTime.localeCompare(b.plannedStartTime));
  }

  private groupByDock(vvns: OemVvn[]): Map<string, OemVvn[]> {
    const map = new Map<string, OemVvn[]>();
    for (const vvn of vvns) {
      const key = vvn.dockId ?? 'UNKNOWN';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(vvn);
    }
    return map;
  }

  private computePlannedStart(eta: Date, currentDockTime: Date): Date {
    const etaTime = eta.getTime();
    const dockTime = currentDockTime.getTime();
    return etaTime > dockTime ? new Date(etaTime) : new Date(dockTime);
  }

  private computeDelayMinutes(plannedEnd: Date, etd?: Date): number | null {
    if (!etd) {
      return null;
    }
    const diffMs = plannedEnd.getTime() - etd.getTime();
    return Math.round(diffMs / 60_000);
  }

  private buildOperations(plannedStart: Date, plannedEnd: Date): OperationTaskPreviewDto[] {
    const totalMs = Math.max(plannedEnd.getTime() - plannedStart.getTime(), 0);
    const halfMs = Math.round(totalMs / 2);

    const unloadEnd = new Date(plannedStart.getTime() + halfMs);
    const loadStart = new Date(unloadEnd.getTime());

    const unload: OperationTaskPreviewDto = {
      type: 'UNLOAD',
      craneId: 'CRANE-1',
      storageAreaId: 'YARD-1',
      startTime: plannedStart.toISOString(),
      endTime: unloadEnd.toISOString(),
    };

    const load: OperationTaskPreviewDto = {
      type: 'LOAD',
      craneId: 'CRANE-1',
      storageAreaId: 'YARD-1',
      startTime: loadStart.toISOString(),
      endTime: plannedEnd.toISOString(),
    };

    return [unload, load];
  }

  private getDayRange(date: string): { start: Date; end: Date } {
    const trimmed = date?.trim();
    if (!trimmed) {
      throw new BadRequestException('Date parameter is required.');
    }

    const start = new Date(`${trimmed}T00:00:00.000Z`);
    const end = new Date(`${trimmed}T23:59:59.999Z`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date supplied. Expected YYYY-MM-DD.');
    }

    return { start, end };
  }
}
