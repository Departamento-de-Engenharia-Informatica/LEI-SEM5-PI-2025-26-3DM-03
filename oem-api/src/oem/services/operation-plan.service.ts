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
import { OperationPlanPreviewDto, OperationTaskPreviewDto } from '../operation-plans/dtos';
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

    const grouped = this.groupByDock(vvns);
    const previews: OperationPlanPreviewDto[] = [];

    for (const [, dockVvns] of grouped) {
      dockVvns.sort((a, b) => a.eta.getTime() - b.eta.getTime());
      let currentDockTime = new Date(dockVvns[0].eta.getTime());

      for (const vvn of dockVvns) {
        const plannedStart = this.computePlannedStart(vvn.eta, currentDockTime);
        const schedule = this.buildScheduleForVvn(vvn, plannedStart, algorithm);
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

  private buildScheduleForVvn(
    vvn: OemVvn,
    plannedStart: Date,
    algorithm: string,
  ): { plannedStart: Date; plannedEnd: Date; operations: OperationTaskPreviewDto[] } {
    const baseDurationMinutes = Math.max(vvn.containers * 2, 60); // hardcoded rate: 2 min/container, min 1h
    const storageArea = `YARD-${vvn.dockId ?? 'GEN'}`;

    if (algorithm === 'multi-crane') {
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
            craneId: 'CRANE-A',
            storageAreaId: storageArea,
            startTime: plannedStart.toISOString(),
            endTime: mid.toISOString(),
          },
          {
            type: 'LOAD',
            craneId: 'CRANE-B',
            storageAreaId: storageArea,
            startTime: mid.toISOString(),
            endTime: plannedEnd.toISOString(),
          },
        ],
      };
    }

    // default: single-crane sequential (optimal placeholder)
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
          craneId: 'CRANE-1',
          storageAreaId: storageArea,
          startTime: plannedStart.toISOString(),
          endTime: unloadEnd.toISOString(),
        },
        {
          type: 'LOAD',
          craneId: 'CRANE-1',
          storageAreaId: storageArea,
          startTime: loadStart.toISOString(),
          endTime: plannedEnd.toISOString(),
        },
      ],
    };
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
