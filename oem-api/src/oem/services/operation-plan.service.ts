import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { Between, LessThanOrEqual, MoreThanOrEqual, Not, Repository } from 'typeorm';
import {
  CreateOperationPlanDto,
  GenerateOperationPlansDto,
  OperationPlanTaskDto,
  UpdateOperationPlanDto,
} from '../dto';
import {
  OperationPlanPreviewDto,
  OperationTaskPreviewDto,
  ResourceAllocationQueryDto,
  ResourceAllocationResourceType,
  ResourceAllocationSummaryDto,
} from '../operation-plans/dtos';
import { OperationPlanStatus } from '../domain';
import { OperationPlanEntity } from '../persistence/operation-plan.entity';
import { ExternalClientsService, VesselVisitNotification } from './external-clients.service';
import { OemVvnService } from '../vvn/oem-vvn.service';
import { OemVvn } from '../vvn/oem-vvn.entity';
import { OperationPlanTaskEntity } from '../persistence/operation-plan-task.entity';
import { OperationPlanChangeLogEntity } from '../persistence/operation-plan-change-log.entity';
import { OperationPlanMapper } from '../mappers/operation-plan.mapper';

export type OperationPlanUpdateResult = {
  plan: OperationPlanEntity;
  warnings: string[];
  logEntry?: OperationPlanChangeLogEntity;
};

type ExternalResourceDto = {
  code: string;
  description?: string;
  type: string;
  status: string;
  operationalCapacity?: number;
  assignedArea?: string | null;
  requiredQualifications?: string[];
};

type ExternalStorageAreaDto = {
  id: number;
  type?: string | null;
  location?: string | null;
};

type ExternalStaffDto = {
  mecanographicNumber: string;
  shortName?: string;
  status?: string;
  active: boolean;
};

type PlanningResources = {
  craneIds: string[];
  storageAreaIds: string[];
  staffIds: string[];
};

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

  async findAll(filters?: {
    from?: string;
    to?: string;
    vesselVisitId?: number | string;
  }): Promise<OperationPlanEntity[]> {
    try {
      const where: Record<string, unknown> = {};

      if (filters?.vesselVisitId != null) {
        const vId = Number(filters.vesselVisitId);
        if (!Number.isNaN(vId)) {
          where.vesselVisitId = vId;
        }
      }

      if (filters?.from && filters?.to) {
        const { start } = this.getDayRange(filters.from);
        const { end } = this.getDayRange(filters.to);
        where.plannedStartTime = Between(start, end);
      } else if (filters?.from) {
        const { start } = this.getDayRange(filters.from);
        where.plannedStartTime = MoreThanOrEqual(start);
      } else if (filters?.to) {
        const { end } = this.getDayRange(filters.to);
        where.plannedStartTime = LessThanOrEqual(end);
      }

      return await this.repo.find({
        where,
        order: { plannedStartTime: 'ASC', createdAt: 'DESC' },
        relations: ['tasks'],
      });
    } catch (error) {
      // In dev scenarios we prefer not to break the SPA if the
      // operation_plans table is empty or misconfigured. Instead,
      // we log the error and return an empty list so that the
      // "Planos guardados" section simply appears vazio.
      // eslint-disable-next-line no-console
      console.error('Failed to load operation plans from database', error);
      return [];
    }
  }

  async findOne(id: number): Promise<OperationPlanEntity> {
    const found = await this.repo.findOne({
      where: { id },
      relations: ['tasks', 'changeLogs'],
      order: {
        tasks: { startTime: 'ASC' },
        changeLogs: { createdAt: 'DESC' },
      },
    });
    if (!found) {
      throw new NotFoundException(`Operation plan ${id} not found`);
    }
    return found;
  }

  async generateAndPersistForDay(
    date: string,
    algorithm = 'single-crane',
    createdBy?: string,
    vvnIds?: number[],
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

    const previews = await this.generatePreviewForDay(date, algorithm, vvnIds);
    if (!previews.length) {
      return [];
    }

    return this.persistPreviews(previews, date, algorithm, createdBy, start);
  }

  async createPlan(dto: CreateOperationPlanDto): Promise<OperationPlanEntity> {
    const entity = this.repo.create(OperationPlanMapper.toPersistenceFromCreate(dto));
    return this.repo.save(entity);
  }

  async updatePlan(
    id: number,
    dto: UpdateOperationPlanDto,
    updatedBy?: string,
  ): Promise<OperationPlanUpdateResult> {
    const existing = await this.findOne(id);

    const taskValidationErrors = this.validateTasks(dto.tasks);
    if (taskValidationErrors.length) {
      throw new BadRequestException(taskValidationErrors.join(' '));
    }

    const normalizedTasks = OperationPlanMapper.normalizeTasksForUpdate(
      existing,
      dto,
      this.taskRepo,
    );

    const candidatePlan: Partial<OperationPlanEntity> = OperationPlanMapper.buildCandidatePlan(
      existing,
      dto,
    );

    const planDay =
      dto.targetDay ?? existing.targetDay?.toISOString().slice(0, 10) ?? dto.plannedStartTime?.slice(0, 10);
    const warnings = await this.detectInconsistencies(candidatePlan, normalizedTasks, planDay);

    const merged = this.repo.merge(
      existing,
      OperationPlanMapper.applyUpdateDto(existing, dto, warnings, updatedBy),
    );

    let logEntry: OperationPlanChangeLogEntity | undefined;

    await this.repo.manager.transaction(async (entityManager) => {
      const planRepo = entityManager.getRepository(OperationPlanEntity);
      const taskRepo = entityManager.getRepository(OperationPlanTaskEntity);
      const logRepo = entityManager.getRepository(OperationPlanChangeLogEntity);

      const savedPlan = await planRepo.save(merged);

      // Replace tasks to keep it simple and predictable.
      await taskRepo.delete({ operationPlanId: savedPlan.id });
      if (normalizedTasks.length) {
        await taskRepo.save(
          normalizedTasks.map((task) => ({
            ...task,
            id: undefined, // force new ids so history in change log captures deltas
            operationPlanId: savedPlan.id,
          })),
        );
      }

      const changes: Record<string, unknown> = {
        fields: this.extractPlanFieldChanges(existing, merged),
        tasksUpdated: normalizedTasks.length,
      };

      logEntry = logRepo.create({
        operationPlanId: savedPlan.id,
        changedBy: updatedBy,
        reason: dto.reason,
        changes,
        warnings,
      });
      await logRepo.save(logEntry);
    });

    const plan = await this.findOne(id);
    return { plan, warnings, logEntry };
  }

  async remove(id: number): Promise<OperationPlanEntity> {
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
          vesselVisitId:
            vvn.vesselVisitId != null
              ? Number(vvn.vesselVisitId)
              : vvn.id != null
                ? Number(vvn.id)
                : undefined,
          sourceVvnId: vvn.id != null ? Number(vvn.id) : undefined,
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
    algorithm = 'single-crane',
    vvnIds?: number[],
  ): Promise<OperationPlanPreviewDto[]> {
    let vvns: OemVvn[] = await this.vvnService.getApprovedForDay(date);
    if (vvnIds && vvnIds.length > 0) {
      const set = new Set(vvnIds);
      vvns = vvns.filter((v) => set.has(v.id));
      if (!vvns.length) {
        return [];
      }
    }
    if (!vvns.length) {
      return [];
    }

    const planningResources = await this.loadPlanningResources();

    const grouped = this.groupByDock(vvns);
    const previews: OperationPlanPreviewDto[] = [];

    for (const [, dockVvns] of grouped) {
      dockVvns.sort((a, b) => a.eta.getTime() - b.eta.getTime());
      let currentDockTime = new Date(dockVvns[0].eta.getTime());

      for (const vvn of dockVvns) {
        const plannedStart = this.computePlannedStart(vvn.eta, currentDockTime);
        const schedule = this.buildScheduleForVvn(
          vvn,
          plannedStart,
          algorithm,
          planningResources,
        );
        currentDockTime = new Date(schedule.plannedEnd.getTime());

        const expectedDelayMinutes = this.computeDelayMinutes(schedule.plannedEnd, vvn.etd);

        previews.push({
          vvnId: vvn.id,
          vesselName: vvn.vesselName,
          dockId: vvn.dockId,
          plannedStartTime: schedule.plannedStart.toISOString(),
          plannedEndTime: schedule.plannedEnd.toISOString(),
          expectedDelayMinutes,
          algorithmUsed: algorithm,
          operations: schedule.operations,
        });
      }
    }

    return previews.sort((a, b) => a.plannedStartTime.localeCompare(b.plannedStartTime));
  }

  async findMissingPlansForDay(date: string): Promise<OemVvn[]> {
    const vvns = await this.vvnService.getApprovedForDay(date);
    if (!vvns.length) {
      return [];
    }

    const { start, end } = this.getDayRange(date);
    const existingPlans = await this.repo.find({
      where: { plannedStartTime: Between(start, end) },
      select: ['id', 'vesselVisitId', 'sourceVvnId'],
    });

    const linkedIds = new Set<number>();
    existingPlans.forEach((plan) => {
      if (plan.sourceVvnId != null) linkedIds.add(Number(plan.sourceVvnId));
      else if (plan.vesselVisitId != null) linkedIds.add(Number(plan.vesselVisitId));
    });

    return vvns.filter((v) => !linkedIds.has(v.id));
  }

  async regenerateMissingForDay(
    date: string,
    algorithm = 'single-crane',
    createdBy?: string,
    confirmOverwrite?: boolean,
  ): Promise<OperationPlanEntity[]> {
    const vvns = await this.vvnService.getApprovedForDay(date);
    if (!vvns.length) {
      return [];
    }

    const { start, end } = this.getDayRange(date);
    const existingPlans = await this.repo.find({
      where: { plannedStartTime: Between(start, end) },
      select: ['id'],
    });

    if (existingPlans.length > 0 && !confirmOverwrite) {
      throw new ConflictException(
        'Regeneration will overwrite existing plans for this day. Set confirmOverwrite=true to proceed.',
      );
    }

    if (existingPlans.length > 0) {
      await this.repo.delete(existingPlans.map((p) => p.id));
    }

    const previews = await this.generatePreviewForDay(
      date,
      algorithm,
      vvns.map((v) => v.id),
    );

    if (!previews.length) {
      return [];
    }

    return this.persistPreviews(previews, date, algorithm, createdBy, start);
  }

  async getResourceAllocationSummary(
    query: ResourceAllocationQueryDto,
  ): Promise<ResourceAllocationSummaryDto[]> {
    const { start, end } = this.getPeriodRange(query.fromDate, query.toDate);
    const resourceId = query.resourceId?.trim() ? query.resourceId.trim() : undefined;

    switch (query.resourceType) {
      case 'dock':
        return this.aggregateDockAllocations(start, end, resourceId);
      case 'staff':
        return this.aggregateStaffAllocations(start, end, resourceId);
      case 'crane':
      default:
        return this.aggregateCraneAllocations(start, end, resourceId);
    }
  }

  async ensureDevSeed(): Promise<void> {
    const env = process.env.NODE_ENV?.toLowerCase();
    if (env === 'production') {
      return;
    }

    const seedMarker = 'dev-seed';
    const existingSeeds = await this.repo.find({ where: { createdBy: seedMarker } });
    if (existingSeeds.length >= 2) {
      return;
    }

    const existingNames = new Set(existingSeeds.map((plan) => plan.name));

    const seedFactories: Array<() => Partial<OperationPlanEntity>> = [
      () => ({
        name: 'Dev Seed - Sunrise Alpha',
        description: 'Demo plan generated for developer testing (crane alpha).',
        vesselVisitId: 9001,
        sourceVvnId: 9001,
        dockId: 'DCK-A1',
        plannedStartTime: new Date('2025-12-02T07:00:00Z'),
        plannedEndTime: new Date('2025-12-02T12:30:00Z'),
        shiftDate: new Date('2025-12-02T07:00:00Z'),
        targetDay: new Date('2025-12-02T00:00:00Z'),
        algorithmUsed: 'single-crane',
        status: OperationPlanStatus.Planned,
        createdBy: seedMarker,
        operations: [
          {
            resourceId: 'CRANE-ALPHA',
            resourceType: 'crane',
            operationType: 'unload',
            startTime: new Date('2025-12-02T07:00:00Z'),
            endTime: new Date('2025-12-02T09:30:00Z'),
          },
          {
            resourceId: 'DOCK-A1',
            resourceType: 'dock',
            operationType: 'other',
            startTime: new Date('2025-12-02T07:00:00Z'),
            endTime: new Date('2025-12-02T12:30:00Z'),
          },
        ],
        tasks: [
          this.taskRepo.create({
            type: 'UNLOAD',
            craneId: 'CRANE-ALPHA',
            storageAreaId: 'YARD-A',
            staffIds: ['crew-101', 'crew-102'],
            startTime: new Date('2025-12-02T07:00:00Z'),
            endTime: new Date('2025-12-02T09:30:00Z'),
          }),
          this.taskRepo.create({
            type: 'LOAD',
            craneId: 'CRANE-ALPHA',
            storageAreaId: 'YARD-A',
            staffIds: ['crew-102', 'crew-103'],
            startTime: new Date('2025-12-02T09:30:00Z'),
            endTime: new Date('2025-12-02T12:30:00Z'),
          }),
        ],
      }),
      () => ({
        name: 'Dev Seed - Harbor Bravo',
        description: 'Demo plan generated for developer testing (crane bravo).',
        vesselVisitId: 9002,
        sourceVvnId: 9002,
        dockId: 'DCK-B2',
        plannedStartTime: new Date('2025-12-05T06:30:00Z'),
        plannedEndTime: new Date('2025-12-05T11:45:00Z'),
        shiftDate: new Date('2025-12-05T06:30:00Z'),
        targetDay: new Date('2025-12-05T00:00:00Z'),
        algorithmUsed: 'multi-crane',
        status: OperationPlanStatus.Planned,
        createdBy: seedMarker,
        operations: [
          {
            resourceId: 'CRANE-BRAVO',
            resourceType: 'crane',
            operationType: 'unload',
            startTime: new Date('2025-12-05T06:30:00Z'),
            endTime: new Date('2025-12-05T09:00:00Z'),
          },
          {
            resourceId: 'DOCK-B2',
            resourceType: 'dock',
            operationType: 'other',
            startTime: new Date('2025-12-05T06:30:00Z'),
            endTime: new Date('2025-12-05T11:45:00Z'),
          },
        ],
        tasks: [
          this.taskRepo.create({
            type: 'UNLOAD',
            craneId: 'CRANE-BRAVO',
            storageAreaId: 'YARD-B',
            staffIds: ['crew-201', 'crew-202'],
            startTime: new Date('2025-12-05T06:30:00Z'),
            endTime: new Date('2025-12-05T09:00:00Z'),
          }),
          this.taskRepo.create({
            type: 'LOAD',
            craneId: 'CRANE-BRAVO',
            storageAreaId: 'YARD-B',
            staffIds: ['crew-203', 'crew-202'],
            startTime: new Date('2025-12-05T09:15:00Z'),
            endTime: new Date('2025-12-05T11:45:00Z'),
          }),
        ],
      }),
    ];

    const toPersist: OperationPlanEntity[] = [];

    for (const factory of seedFactories) {
      const candidate = factory();
      if (!candidate.name || existingNames.has(candidate.name)) {
        continue;
      }
      toPersist.push(this.repo.create(candidate));
    }

    if (!toPersist.length) {
      return;
    }

    await this.repo.save(toPersist);
  }

  private async aggregateCraneAllocations(
    rangeStart: Date,
    rangeEnd: Date,
    resourceId?: string,
  ): Promise<ResourceAllocationSummaryDto[]> {
    const tasks = await this.taskRepo.find({
      where: {
        startTime: LessThanOrEqual(rangeEnd),
        endTime: MoreThanOrEqual(rangeStart),
      },
    });

    const totals = new Map<string, { minutes: number; operations: number }>();

    for (const task of tasks) {
      if (!task.craneId) {
        continue;
      }
      if (resourceId && task.craneId !== resourceId) {
        continue;
      }

      const minutes = this.computeOverlapMinutes(task.startTime, task.endTime, rangeStart, rangeEnd);
      if (minutes <= 0) {
        continue;
      }

      const current = totals.get(task.craneId) ?? { minutes: 0, operations: 0 };
      current.minutes += minutes;
      current.operations += 1;
      totals.set(task.craneId, current);
    }

    return this.toSummaryDtos('crane', totals);
  }

  private async aggregateStaffAllocations(
    rangeStart: Date,
    rangeEnd: Date,
    resourceId?: string,
  ): Promise<ResourceAllocationSummaryDto[]> {
    const tasks = await this.taskRepo.find({
      where: {
        startTime: LessThanOrEqual(rangeEnd),
        endTime: MoreThanOrEqual(rangeStart),
      },
    });

    const totals = new Map<string, { minutes: number; operations: number }>();

    for (const task of tasks) {
      if (!task.staffIds?.length) {
        continue;
      }

      const minutes = this.computeOverlapMinutes(task.startTime, task.endTime, rangeStart, rangeEnd);
      if (minutes <= 0) {
        continue;
      }

      for (const staffId of task.staffIds) {
        if (!staffId) {
          continue;
        }
        if (resourceId && staffId !== resourceId) {
          continue;
        }

        const current = totals.get(staffId) ?? { minutes: 0, operations: 0 };
        current.minutes += minutes;
        current.operations += 1;
        totals.set(staffId, current);
      }
    }

    return this.toSummaryDtos('staff', totals);
  }

  private async aggregateDockAllocations(
    rangeStart: Date,
    rangeEnd: Date,
    resourceId?: string,
  ): Promise<ResourceAllocationSummaryDto[]> {
    const qb = this.repo
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.tasks', 'task')
      .where('plan.dockId IS NOT NULL')
      .andWhere('plan.plannedStartTime < :rangeEnd', { rangeEnd })
      .andWhere('(plan.plannedEndTime IS NULL OR plan.plannedEndTime > :rangeStart)', {
        rangeStart,
      });

    if (resourceId) {
      qb.andWhere('plan.dockId = :dockId', { dockId: resourceId });
    }

    const plans = await qb.getMany();

    const totals = new Map<string, { minutes: number; operations: number }>();

    for (const plan of plans) {
      if (!plan.dockId) {
        continue;
      }
      if (resourceId && plan.dockId !== resourceId) {
        continue;
      }

      const { start, end } = this.computePlanTimeline(plan);
      const minutes = this.computeOverlapMinutes(start, end, rangeStart, rangeEnd);
      if (minutes <= 0) {
        continue;
      }

      const current = totals.get(plan.dockId) ?? { minutes: 0, operations: 0 };
      current.minutes += minutes;
      current.operations += 1;
      totals.set(plan.dockId, current);
    }

    return this.toSummaryDtos('dock', totals);
  }

  private validateTasks(tasks?: (OperationPlanTaskDto | OperationPlanTaskEntity)[]): string[] {
    if (!tasks || tasks.length === 0) {
      return [];
    }
    const errors: string[] = [];
    tasks.forEach((task, idx) => {
      const start = task.startTime instanceof Date ? task.startTime : new Date(task.startTime);
      const end = task.endTime instanceof Date ? task.endTime : new Date(task.endTime);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        errors.push(`Task #${idx + 1} has invalid dates.`);
      } else if (start.getTime() >= end.getTime()) {
        errors.push(`Task #${idx + 1} must finish after it starts.`);
      }
    });
    return errors;
  }

  private computePlanTimeline(plan: OperationPlanEntity): { start: Date | null; end: Date | null } {
    const planStart = this.toDate(plan.plannedStartTime);
    const planEnd = this.toDate(plan.plannedEndTime);

    let earliest = planStart;
    let latest = planEnd;

    if (plan.tasks?.length) {
      for (const task of plan.tasks) {
        const taskStart = this.toDate(task.startTime);
        const taskEnd = this.toDate(task.endTime);
        if (taskStart && (!earliest || taskStart < earliest)) {
          earliest = taskStart;
        }
        if (taskEnd && (!latest || taskEnd > latest)) {
          latest = taskEnd;
        }
      }
    }

    return {
      start: earliest ?? null,
      end: latest ?? null,
    };
  }

  private toSummaryDtos(
    resourceType: ResourceAllocationResourceType,
    totals: Map<string, { minutes: number; operations: number }>,
  ): ResourceAllocationSummaryDto[] {
    const summaries: ResourceAllocationSummaryDto[] = [];

    for (const [resourceId, stats] of totals) {
      const minutes = this.roundMinutes(stats.minutes);
      if (minutes <= 0) {
        continue;
      }

      summaries.push({
        resourceType,
        resourceId,
        totalAllocatedMinutes: minutes,
        totalAllocatedHours: this.roundMinutes(minutes / 60),
        operationCount: stats.operations,
      });
    }

    summaries.sort((a, b) => {
      const diff = b.totalAllocatedMinutes - a.totalAllocatedMinutes;
      if (Math.abs(diff) > 0.0001) {
        return diff;
      }
      return a.resourceId.localeCompare(b.resourceId);
    });

    return summaries;
  }

  private roundMinutes(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private computeOverlapMinutes(
    rawStart: Date | string | null | undefined,
    rawEnd: Date | string | null | undefined,
    rangeStart: Date,
    rangeEnd: Date,
  ): number {
    const start = this.toDate(rawStart);
    const end = this.toDate(rawEnd);

    if (!start || !end) {
      return 0;
    }

    if (end.getTime() <= start.getTime()) {
      return 0;
    }

    const clampedStart = start.getTime() < rangeStart.getTime() ? rangeStart : start;
    const clampedEnd = end.getTime() > rangeEnd.getTime() ? rangeEnd : end;
    const diffMs = clampedEnd.getTime() - clampedStart.getTime();

    if (diffMs <= 0) {
      return 0;
    }

    return diffMs / 60_000;
  }

  private toDate(value?: Date | string | null): Date | null {
    if (!value) {
      return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date;
  }

  private async detectInconsistencies(
    candidatePlan: Partial<OperationPlanEntity>,
    tasks: OperationPlanTaskEntity[],
    planDay?: string | null,
  ): Promise<string[]> {
    const warnings: string[] = [];
    if (!tasks.length) {
      return warnings;
    }

    const dayIso =
      planDay ?? this.toIsoDate(candidatePlan.plannedStartTime) ?? this.toIsoDate(tasks[0].startTime);

    let otherPlans: OperationPlanEntity[] = [];
    if (dayIso) {
      try {
        const { start, end } = this.getDayRange(dayIso);
        const excludeId = candidatePlan.id ?? -1;
        otherPlans = await this.repo.find({
          where: { id: Not(excludeId), plannedStartTime: Between(start, end) },
          relations: ['tasks'],
        });
      } catch {
        // ignore filter errors
      }
    }

    for (const task of tasks) {
      if (candidatePlan.plannedStartTime && task.startTime < candidatePlan.plannedStartTime) {
        warnings.push(
          `Task ${task.type} starts before the plan start (${candidatePlan.plannedStartTime.toISOString()}).`,
        );
      }
      if (candidatePlan.plannedEndTime && task.endTime > candidatePlan.plannedEndTime) {
        warnings.push(
          `Task ${task.type} ends after the plan end (${candidatePlan.plannedEndTime.toISOString()}).`,
        );
      }

      for (const other of otherPlans) {
        if (!other.tasks?.length) continue;
        for (const otherTask of other.tasks) {
          if (
            task.craneId &&
            otherTask.craneId &&
            task.craneId === otherTask.craneId &&
            this.overlaps(task.startTime, task.endTime, otherTask.startTime, otherTask.endTime)
          ) {
            warnings.push(
              `Crane ${task.craneId} overlaps with plan ${other.name} (${other.id}) between ${task.startTime.toISOString()} and ${task.endTime.toISOString()}.`,
            );
          }

          if (task.staffIds?.length && otherTask.staffIds?.length) {
            const sharedStaff = task.staffIds.filter((id) => otherTask.staffIds?.includes(id));
            if (
              sharedStaff.length &&
              this.overlaps(task.startTime, task.endTime, otherTask.startTime, otherTask.endTime)
            ) {
              warnings.push(
                `Staff ${sharedStaff.join(', ')} already assigned to plan ${other.name} (${other.id}) for the same time.`,
              );
            }
          }
        }
      }
    }

    if (dayIso && candidatePlan.sourceVvnId) {
      try {
        const vvns = await this.vvnService.getApprovedForDay(dayIso);
        const current = vvns.find((v) => v.id === candidatePlan.sourceVvnId);
        if (current) {
          const start = candidatePlan.plannedStartTime ?? tasks[0].startTime;
          const end =
            candidatePlan.plannedEndTime ?? tasks[tasks.length - 1].endTime ?? tasks[0].endTime;
          if (current.eta && start.getTime() < current.eta.getTime()) {
            warnings.push('Plan starts before the approved VVN ETA.');
          }
          if (current.etd && end.getTime() > current.etd.getTime()) {
            warnings.push('Plan end exceeds the VVN estimated departure.');
          }
        }
      } catch {
        // ignore warning enrichment failures
      }
    }

    return Array.from(new Set(warnings));
  }

  private extractPlanFieldChanges(
    oldPlan: OperationPlanEntity,
    newPlan: OperationPlanEntity,
  ): Record<string, unknown> {
    const watched: Array<keyof OperationPlanEntity> = [
      'dockId',
      'plannedStartTime',
      'plannedEndTime',
      'algorithmUsed',
      'status',
    ];
    const diff: Record<string, unknown> = {};
    for (const key of watched) {
      const before = (oldPlan as any)[key];
      const after = (newPlan as any)[key];
      const beforeVal = before instanceof Date ? before.toISOString() : before;
      const afterVal = after instanceof Date ? after.toISOString() : after;
      if (beforeVal !== afterVal) {
        diff[key] = { before: beforeVal, after: afterVal };
      }
    }
    return diff;
  }

  private overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
    return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
  }

  private async persistPreviews(
    previews: OperationPlanPreviewDto[],
    date: string,
    algorithm: string,
    createdBy?: string,
    targetDay?: Date,
  ): Promise<OperationPlanEntity[]> {
    const dayStart = targetDay ?? this.getDayRange(date).start;

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
          targetDay: dayStart,
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
              staffIds: operation.staffIds && operation.staffIds.length ? operation.staffIds : undefined,
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

  private toIsoDate(value?: Date | string | null): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
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

  private async loadPlanningResources(): Promise<PlanningResources> {
    try {
      const [resourcesResp, storageResp, staffResp] = await Promise.all([
        firstValueFrom(this.externalClients.callResources('/Resources', { timeout: 2_000 })),
        firstValueFrom(this.externalClients.callStorageAreas('/StorageAreas', { timeout: 2_000 })),
        firstValueFrom(this.externalClients.callStaff('/Staff', { timeout: 2_000 })),
      ]);

      const resources = (resourcesResp.data as ExternalResourceDto[]) ?? [];
      const storageAreas = (storageResp.data as ExternalStorageAreaDto[]) ?? [];
      const staff = (staffResp.data as ExternalStaffDto[]) ?? [];

      const craneIds = resources
        .filter(
          (r) =>
            r.type &&
            r.code &&
            r.status &&
            r.type.toLowerCase() === 'crane' &&
            r.status.toLowerCase() === 'active',
        )
        .map((r) => r.code.trim())
        .filter(Boolean);

      const storageAreaIds = storageAreas
        .map((a) => a.location?.trim() || String(a.id))
        .filter(Boolean);

      const staffIds = staff
        .filter(
          (s) =>
            s.active &&
            s.mecanographicNumber &&
            (!s.status || s.status.toLowerCase() === 'active'),
        )
        .map((s) => s.mecanographicNumber.trim())
        .filter(Boolean);

      return {
        craneIds,
        storageAreaIds,
        staffIds,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(
        'Failed to load external resources for planning, falling back to default placeholders.',
        error,
      );
      return {
        craneIds: [],
        storageAreaIds: [],
        staffIds: [],
      };
    }
  }

  private pickCraneId(resources: PlanningResources): string | undefined {
    return resources.craneIds[0];
  }

  private pickMultiCraneIds(resources: PlanningResources): [string, string] {
    const first = resources.craneIds[0] ?? 'CRANE-A';
    const second = resources.craneIds[1] ?? first;
    return [first, second];
  }

  private pickStorageAreaId(resources: PlanningResources): string | undefined {
    return resources.storageAreaIds[0];
  }

  private pickStaffIds(resources: PlanningResources): string[] | undefined {
    if (!resources.staffIds.length) {
      return undefined;
    }
    return resources.staffIds.slice(0, 2);
  }

  private buildScheduleForVvn(
    vvn: OemVvn,
    plannedStart: Date,
    algorithm: string,
    planningResources: PlanningResources,
  ): { plannedStart: Date; plannedEnd: Date; operations: OperationTaskPreviewDto[] } {
    const baseDurationMinutes = Math.max(vvn.containers * 2, 60); // hardcoded rate: 2 min/container, min 1h
    const storageArea =
      this.pickStorageAreaId(planningResources) ?? `YARD-${vvn.dockId ?? 'GEN'}`;
    const staffIds = this.pickStaffIds(planningResources) ?? [];

    if (algorithm === 'multi-crane') {
      const [craneA, craneB] = this.pickMultiCraneIds(planningResources);
      const effectiveMinutes = Math.ceil(baseDurationMinutes / 2); // two cranes to cut duration
      const plannedEnd = new Date(plannedStart.getTime() + effectiveMinutes * 60_000);
      const totalMs = Math.max(plannedEnd.getTime() - plannedStart.getTime(), 0);
      const mid = new Date(plannedStart.getTime() + Math.round(totalMs / 2));

      return {
        plannedStart,
        plannedEnd,
        operations: [
          {
            type: 'UNLOAD',
            craneId: craneA,
            storageAreaId: storageArea,
            staffIds,
            startTime: plannedStart.toISOString(),
            endTime: mid.toISOString(),
          },
          {
            type: 'LOAD',
            craneId: craneB,
            storageAreaId: storageArea,
            staffIds,
            startTime: mid.toISOString(),
            endTime: plannedEnd.toISOString(),
          },
        ],
      };
    }

    // default: single-crane sequential (optimal placeholder)
    const craneId = this.pickCraneId(planningResources) ?? 'CRANE-1';
    const plannedEnd = new Date(plannedStart.getTime() + baseDurationMinutes * 60_000);
    const totalMs = Math.max(plannedEnd.getTime() - plannedStart.getTime(), 0);
    const halfMs = Math.round(totalMs / 2);

    const unloadEnd = new Date(plannedStart.getTime() + halfMs);
    const loadStart = new Date(unloadEnd.getTime());

    return {
      plannedStart,
      plannedEnd,
      operations: [
        {
          type: 'UNLOAD',
          craneId,
          storageAreaId: storageArea,
          staffIds,
          startTime: plannedStart.toISOString(),
          endTime: unloadEnd.toISOString(),
        },
        {
          type: 'LOAD',
          craneId,
          storageAreaId: storageArea,
          staffIds,
          startTime: loadStart.toISOString(),
          endTime: plannedEnd.toISOString(),
        },
      ],
    };
  }

  private getPeriodRange(from: Date, to: Date): { start: Date; end: Date } {
    const start = this.toDate(from);
    const end = this.toDate(to);

    if (!start || !end) {
      throw new BadRequestException('Invalid ISO-8601 date supplied for "from" or "to".');
    }

    if (start.getTime() >= end.getTime()) {
      throw new BadRequestException('"to" must be greater than "from".');
    }

    return { start, end };
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
