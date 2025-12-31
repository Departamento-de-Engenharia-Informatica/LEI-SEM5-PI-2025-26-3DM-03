import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CreateVesselVisitExecutionDto,
  ExecutedOperationDto,
  PlannedOperationWithExecutionDto,
  UpdateVesselVisitExecutionDto,
  UpsertExecutedOperationDto,
  VesselVisitExecutionFilterDto,
  VesselVisitExecutionListItemDto,
} from '../dto';
import { VesselExecutionStatus } from '../domain';
import { VesselVisitExecutionEntity } from '../persistence/vessel-visit-execution.entity';
import { OemVvnService } from '../vvn/oem-vvn.service';
import { VesselVisitExecutionAuditEntity } from '../persistence/vessel-visit-execution-audit.entity';
import { OperationPlanEntity } from '../persistence/operation-plan.entity';
import { OperationPlanStatus } from '../domain/operation-plan.entity';
import {
  OperationExecutionStatus,
  OperationPlanTaskEntity,
} from '../persistence/operation-plan-task.entity';
import { ExecutedOperationEntity } from '../persistence/executed-operation.entity';
import { ExecutedOperationAuditEntity } from '../persistence/executed-operation-audit.entity';
import { AuthenticatedUser } from '../auth/types';
import { CompleteVesselVisitExecutionDto } from '../dto/complete-vessel-visit-execution.dto';

@Injectable()
export class VesselVisitExecutionService {
  constructor(
    @InjectRepository(VesselVisitExecutionEntity)
    private readonly repo: Repository<VesselVisitExecutionEntity>,
    @InjectRepository(OperationPlanEntity)
    private readonly planRepo: Repository<OperationPlanEntity>,
    @InjectRepository(OperationPlanTaskEntity)
    private readonly taskRepo: Repository<OperationPlanTaskEntity>,
    @InjectRepository(ExecutedOperationEntity)
    private readonly executedRepo: Repository<ExecutedOperationEntity>,
    private readonly vvnService: OemVvnService,
  ) {}

  findAll(): Promise<VesselVisitExecutionListItemDto[]> {
    return this.findAllWithFilters({});
  }

  async findAllWithFilters(
    filters: VesselVisitExecutionFilterDto = {} as VesselVisitExecutionFilterDto,
  ): Promise<VesselVisitExecutionListItemDto[]> {
    const qb = this.repo.createQueryBuilder('vve');

    qb.orderBy('vve.actualArrivalTime', 'ASC');

    if (filters.from) {
      const fromDate = this.normalizeBoundary(filters.from, 'start', 'from');
      qb.andWhere('vve.actualArrivalTime >= :from', { from: fromDate });
    }

    if (filters.to) {
      const toDate = this.normalizeBoundary(filters.to, 'end', 'to');
      qb.andWhere('vve.actualArrivalTime <= :to', { to: toDate });
    }

    if (filters.vesselVisitId != null) {
      qb.andWhere('vve.vesselVisitId = :vesselVisitId', {
        vesselVisitId: Number(filters.vesselVisitId),
      });
    }

    if (filters.vesselName) {
      qb.andWhere('LOWER(vve.vesselName) LIKE :vesselName', {
        vesselName: `%${filters.vesselName.toLowerCase()}%`,
      });
    }

    if (filters.status) {
      qb.andWhere('vve.status = :status', { status: filters.status });
    }

    const executions = await qb.getMany();
    return executions.map((execution) => this.mapListItem(execution));
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
    user: AuthenticatedUser | null,
  ): Promise<VesselVisitExecutionEntity> {
    const vvn = await this.vvnService.getById(dto.vvnId);
    const actualArrivalTime = this.toDate(dto.actualArrivalTime, 'actualArrivalTime');

    const normalizedVvnId = this.normalizeVvnId(vvn, dto.vvnId);
    const vesselVisitId = Number(normalizedVvnId);
    const identifier = await this.generateIdentifier(normalizedVvnId);

    const entity = this.repo.create({
      identifier,
      vvnId: normalizedVvnId,
      vesselVisitId: Number.isNaN(vesselVisitId) ? undefined : vesselVisitId,
      vesselName: vvn.vesselName,
      vesselIdentifier: vvn.vesselName,
      berthId: vvn.dockId,
      voyageNumber: undefined,
      operationPlanId: undefined,
      eta: vvn.eta,
      etd: vvn.etd,
      plannedArrivalTime: vvn.eta ?? null,
      plannedBerthTime: null,
      plannedDepartureTime: vvn.etd ?? null,
      actualArrivalTime,
      actualDepartureTime: null,
      createdBy: this.resolveUserId(user),
      status: VesselExecutionStatus.InProgress,
    });

    const latestPlan = await this.findLatestPlannedOperationPlanForVvn(dto.vvnId);
    entity.operationPlanId = latestPlan?.id ?? undefined;

    return this.repo.save(entity);
  }

  async updateExecution(
    id: number,
    dto: UpdateVesselVisitExecutionDto,
    user: AuthenticatedUser | null,
  ): Promise<VesselVisitExecutionEntity> {
    if (!dto.actualBerthTime && !dto.dockId) {
      throw new BadRequestException('Provide at least actualBerthTime or dockId.');
    }

    const existing = await this.findOne(id);

    this.ensureMutableOrAdmin(existing, user, 'update berth/dock');

    if (existing.status !== VesselExecutionStatus.InProgress) {
      throw new BadRequestException(
        'Only in-progress vessel visit executions can update berth time or dock.',
      );
    }

    const beforeSnapshot = this.buildAuditSnapshot(existing);

    let plannedDock: string | undefined;
    try {
      const plannedVvn = await this.vvnService.getById(existing.vvnId);
      plannedDock = plannedVvn?.dockId ? String(plannedVvn.dockId).trim() : undefined;
    } catch (error) {
      plannedDock = undefined;
    }

    const nextActualBerthTime = dto.actualBerthTime
      ? this.toDate(dto.actualBerthTime, 'actualBerthTime')
      : existing.actualBerthTime;

    if (dto.actualBerthTime) {
      if (!existing.actualArrivalTime) {
        throw new BadRequestException(
          'Nao pode registar a atracacao sem ter uma hora de chegada definida.',
        );
      }

      if (nextActualBerthTime && nextActualBerthTime < existing.actualArrivalTime) {
        throw new BadRequestException(
          'A hora de atracacao nao pode ser anterior a hora de chegada.',
        );
      }
    }

    let note: string | undefined;
    let nextBerthId = existing.berthId ?? null;
    let nextLastWarning = existing.lastWarning ?? null;

    if (dto.dockId) {
      nextBerthId = dto.dockId.trim();
      if (plannedDock && nextBerthId !== plannedDock) {
        note = `Dock mismatch: planned ${plannedDock}, actual ${nextBerthId}`;
        nextLastWarning = note;
      } else {
        nextLastWarning = null;
      }
    }

    return this.repo.manager.transaction(async (manager) => {
      const vveRepo = manager.getRepository(VesselVisitExecutionEntity);
      const auditRepo = manager.getRepository(VesselVisitExecutionAuditEntity);

      existing.actualBerthTime = nextActualBerthTime ?? null;
      existing.berthId = nextBerthId ?? null;
      existing.lastWarning = nextLastWarning ?? null;

      const saved = await vveRepo.save(existing);

      const auditPayload: Partial<VesselVisitExecutionAuditEntity> = {
        vveId: saved.id,
        changedBy: this.resolveUserId(user),
        action: 'UPDATE_BERTH_DOCK',
        before: beforeSnapshot,
        after: this.buildAuditSnapshot(saved),
      };

      if (note) {
        auditPayload.note = note;
      }

      const audit = auditRepo.create(auditPayload);

      await auditRepo.save(audit);

      return saved;
    });
  }

  async getPlannedOperations(vveId: number): Promise<PlannedOperationWithExecutionDto[]> {
    const vve = await this.findOne(vveId);
    const plan = await this.resolveOperationPlan(vve);

    const tasks = await this.taskRepo.find({
      where: { operationPlanId: plan.id },
      order: { startTime: 'ASC' },
    });

    return tasks.map((task) => ({
      id: task.id,
      type: task.type,
      craneId: task.craneId ?? null,
      storageAreaId: task.storageAreaId ?? null,
      staffIds: task.staffIds ?? null,
      plannedStartTime: task.startTime.toISOString(),
      plannedEndTime: task.endTime.toISOString(),
      executionStatus: task.executionStatus ?? OperationExecutionStatus.Planned,
      actualStartTime: task.actualStartTime ? task.actualStartTime.toISOString() : null,
      actualEndTime: task.actualEndTime ? task.actualEndTime.toISOString() : null,
      actualResourcesUsed: task.actualResourcesUsed ?? null,
    }));
  }

  async listExecutedOperations(vveId: number): Promise<ExecutedOperationDto[]> {
    const vve = await this.findOne(vveId);

    const executions = await this.executedRepo.find({
      where: { vveId: vve.id },
      order: { plannedOperationId: 'ASC' },
    });

    if (!executions.length) {
      return [];
    }

    const taskIds = executions.map((execution) => execution.plannedOperationId);
    const tasks = await this.taskRepo.find({ where: { id: In(taskIds) } });
    const taskMap = new Map<number, OperationPlanTaskEntity>();
    tasks.forEach((task) => taskMap.set(task.id, task));

    return executions.map((execution) =>
      this.mapExecutedOperationDto(execution, taskMap.get(execution.plannedOperationId) ?? null),
    );
  }

  /**
   * Dev/test helper that links a VVE to an existing operation plan without additional side effects.
   */
  async linkOperationPlan(
    vveId: number,
    operationPlanId: number,
  ): Promise<VesselVisitExecutionEntity> {
    const vve = await this.findOne(vveId);

    const plan = await this.planRepo.findOne({ where: { id: operationPlanId } });
    if (!plan) {
      throw new NotFoundException(`Operation plan ${operationPlanId} not found.`);
    }

    vve.operationPlanId = plan.id;
    return this.repo.save(vve);
  }

  // DEV SEED – temporary, safe to remove before production
  async seedLinkExistingVveToPlan(vveId: number): Promise<VesselVisitExecutionEntity> {
    if (process.env.NODE_ENV !== 'development') {
      throw new NotFoundException('Dev seed helpers are disabled outside development.');
    }

    const execution = await this.findOne(vveId);

    const candidates: Array<string | number | null | undefined> = [
      execution.vesselVisitId,
      execution.vvnId,
    ];

    let numericVvn: number | null = null;
    for (const candidate of candidates) {
      if (candidate == null) continue;
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        numericVvn = parsed;
        break;
      }
    }

    if (numericVvn == null) {
      throw new BadRequestException(
        'Vessel visit execution is missing a numeric VVN identifier; cannot link automatically.',
      );
    }

    const eligibleStatuses = [OperationPlanStatus.Planned, OperationPlanStatus.InProgress];

    const planBySource = await this.planRepo.findOne({
      where: { sourceVvnId: numericVvn, status: In(eligibleStatuses) },
      order: { updatedAt: 'DESC', createdAt: 'DESC' },
    });

    const plan =
      planBySource ??
      (await this.planRepo.findOne({
        where: { vesselVisitId: numericVvn, status: In(eligibleStatuses) },
        order: { updatedAt: 'DESC', createdAt: 'DESC' },
      }));

    if (!plan) {
      throw new NotFoundException(
        `No eligible operation plan found for VVN ${numericVvn}. Ensure a planned or in-progress plan exists.`,
      );
    }

    if (execution.operationPlanId === plan.id) {
      return execution;
    }

    execution.operationPlanId = plan.id;
    execution.operationPlan = undefined;

    return this.repo.save(execution);
  }

  async upsertExecutedOperation(
    vveId: number,
    plannedOperationId: number,
    dto: UpsertExecutedOperationDto,
    user: AuthenticatedUser | null,
  ): Promise<ExecutedOperationDto> {
    if (
      dto.actualStartTime === undefined &&
      dto.actualEndTime === undefined &&
      dto.resourcesUsed === undefined
    ) {
      throw new BadRequestException(
        'Provide at least one of actualStartTime, actualEndTime or resourcesUsed.',
      );
    }

    if (dto.resourcesUsed !== undefined) {
      this.ensureObject('resourcesUsed', dto.resourcesUsed);
    }

    const vve = await this.findOne(vveId);

    this.ensureMutableOrAdmin(vve, user, 'record executed operations');

    if (vve.status !== VesselExecutionStatus.InProgress) {
      throw new BadRequestException('Only in-progress VVEs can record executed operations.');
    }

    const plan = await this.resolveOperationPlan(vve);

    return this.repo.manager.transaction(async (manager) => {
      const executedRepo = manager.getRepository(ExecutedOperationEntity);
      const taskRepo = manager.getRepository(OperationPlanTaskEntity);
      const auditRepo = manager.getRepository(ExecutedOperationAuditEntity);

      const task = await taskRepo.findOne({
        where: { id: plannedOperationId, operationPlanId: plan.id },
      });

      if (!task) {
        throw new NotFoundException(
          `Planned operation ${plannedOperationId} not found for operation plan ${plan.id}.`,
        );
      }

      const existingExecution = await executedRepo.findOne({
        where: { vveId: vve.id, plannedOperationId },
      });

      const beforeSnapshot = this.buildExecutedOperationSnapshot(existingExecution ?? null, task);

      const nextActualStartTime =
        dto.actualStartTime !== undefined
          ? this.toDate(dto.actualStartTime, 'actualStartTime')
          : (existingExecution?.actualStartTime ?? task.actualStartTime ?? null);

      const nextActualEndTime =
        dto.actualEndTime !== undefined
          ? this.toDate(dto.actualEndTime, 'actualEndTime')
          : (existingExecution?.actualEndTime ?? task.actualEndTime ?? null);

      if (nextActualStartTime && nextActualEndTime) {
        if (nextActualEndTime.getTime() <= nextActualStartTime.getTime()) {
          throw new BadRequestException('actualEndTime must be after actualStartTime.');
        }
      }

      const nextResourcesUsed =
        dto.resourcesUsed !== undefined
          ? (dto.resourcesUsed as Record<string, unknown>)
          : (existingExecution?.resourcesUsed ?? task.actualResourcesUsed ?? null);

      const nextStatus = this.computeExecutionStatus(task, nextActualStartTime, nextActualEndTime);

      task.actualStartTime = nextActualStartTime ?? null;
      task.actualEndTime = nextActualEndTime ?? null;
      task.actualResourcesUsed = nextResourcesUsed ?? null;
      task.executionStatus = nextStatus;

      const payload = existingExecution
        ? executedRepo.merge(existingExecution, {
            actualStartTime: nextActualStartTime ?? null,
            actualEndTime: nextActualEndTime ?? null,
            resourcesUsed: nextResourcesUsed ?? null,
            updatedBy: this.resolveUserId(user),
          })
        : executedRepo.create({
            vveId: vve.id,
            plannedOperationId,
            actualStartTime: nextActualStartTime ?? null,
            actualEndTime: nextActualEndTime ?? null,
            resourcesUsed: nextResourcesUsed ?? null,
            createdBy: this.resolveUserId(user),
            updatedBy: this.resolveUserId(user),
          });

      const savedExecution = await executedRepo.save(payload);
      await taskRepo.save(task);

      const afterSnapshot = this.buildExecutedOperationSnapshot(savedExecution, task);

      const audit = auditRepo.create({
        executedOperationId: savedExecution.id,
        changedBy: this.resolveUserId(user),
        action: 'UPSERT_EXECUTED_OPERATION',
        before: beforeSnapshot,
        after: afterSnapshot,
      });

      await auditRepo.save(audit);

      return this.mapExecutedOperationDto(savedExecution, task);
    });
  }

  async remove(id: number): Promise<VesselVisitExecutionEntity> {
    const existing = await this.findOne(id);
    await this.repo.remove(existing);
    return existing;
  }

  async completeExecution(
    id: number,
    dto: CompleteVesselVisitExecutionDto,
    user: AuthenticatedUser | null,
  ): Promise<VesselVisitExecutionEntity> {
    const existing = await this.findOne(id);

    // Enforce read-only rule for non-admins if already completed
    this.ensureMutableOrAdmin(existing, user, 'complete execution');

    if (existing.status === VesselExecutionStatus.Completed && !this.isAdmin(user)) {
      throw new BadRequestException('Vessel visit execution is already completed.');
    }

    // Ensure all associated cargo operations are finished
    await this.ensureAllOperationsFinished(existing);

    const beforeSnapshot = this.buildAuditSnapshot(existing);

    const actualUnberthTime = this.toDate(dto.actualUnberthTime, 'actualUnberthTime');
    const actualPortDepartureTime = this.toDate(
      dto.actualPortDepartureTime,
      'actualPortDepartureTime',
    );

    existing.actualUnberthTime = actualUnberthTime;
    existing.actualDepartureTime = actualPortDepartureTime;
    existing.status = VesselExecutionStatus.Completed;

    return this.repo.manager.transaction(async (manager) => {
      const vveRepo = manager.getRepository(VesselVisitExecutionEntity);
      const auditRepo = manager.getRepository(VesselVisitExecutionAuditEntity);

      const saved = await vveRepo.save(existing);

      const audit = auditRepo.create({
        vveId: saved.id,
        changedBy: this.resolveUserId(user),
        action: 'COMPLETE_EXECUTION',
        before: beforeSnapshot,
        after: this.buildAuditSnapshot(saved),
      });

      await auditRepo.save(audit);

      return saved;
    });
  }

  private toDate(value: string, field: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ISO-8601 date supplied for "${field}".`);
    }
    return parsed;
  }

  private normalizeBoundary(value: string, boundary: 'start' | 'end', field: string): Date {
    const parsed = this.toDate(value, field);
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
    if (isDateOnly) {
      if (boundary === 'start') {
        parsed.setUTCHours(0, 0, 0, 0);
      } else {
        parsed.setUTCHours(23, 59, 59, 999);
      }
    }
    return parsed;
  }

  private ensureObject(field: string, value: unknown): void {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException(`${field} must be a JSON object.`);
    }
  }

  private normalizeVvnId(vvn: { id?: number }, fallback: string | number): string {
    if (vvn?.id != null && Number.isFinite(vvn.id)) {
      return String(vvn.id);
    }
    return String(fallback);
  }

  private async generateIdentifier(vvnId: string | number): Promise<string> {
    const normalized = String(vvnId).trim() || 'UNKNOWN';
    const base = `VVE-${normalized.replace(/[^A-Za-z0-9]/g, '') || 'REF'}`;
    let candidate = base;
    let counter = 1;

    while (await this.repo.exist({ where: { identifier: candidate } })) {
      counter += 1;
      candidate = `${base}-${counter.toString().padStart(2, '0')}`;
      if (counter > 99) {
        candidate = `${base}-${Date.now()}`;
        break;
      }
    }

    return candidate;
  }

  private buildAuditSnapshot(execution: VesselVisitExecutionEntity): Record<string, unknown> {
    return {
      actualBerthTime: execution.actualBerthTime ?? null,
      actualUnberthTime: execution.actualUnberthTime ?? null,
      actualDepartureTime: execution.actualDepartureTime ?? null,
      berthId: execution.berthId ?? null,
      status: execution.status,
      lastWarning: execution.lastWarning ?? null,
    };
  }

  private mapListItem(execution: VesselVisitExecutionEntity): VesselVisitExecutionListItemDto {
    const plannedArrival = execution.plannedArrivalTime ?? execution.eta ?? null;
    const plannedBerth = execution.plannedBerthTime ?? null;
    const plannedDeparture = execution.plannedDepartureTime ?? execution.etd ?? null;
    const actualArrival = execution.actualArrivalTime ?? null;
    const actualBerth = execution.actualBerthTime ?? null;
    const actualUnberth = execution.actualUnberthTime ?? null;
    const actualDeparture = execution.actualDepartureTime ?? null;

    const vesselVisitId = Number.isFinite(execution.vesselVisitId)
      ? Number(execution.vesselVisitId)
      : !Number.isNaN(Number(execution.vvnId))
        ? Number(execution.vvnId)
        : execution.id;

    return {
      id: execution.id,
      vesselVisitId,
      vesselName: execution.vesselName || execution.vesselIdentifier || 'Vessel',
      berthId: execution.berthId ?? null,
      status: execution.status,
      plannedArrivalTime: this.toIso(plannedArrival),
      actualArrivalTime: this.toIso(actualArrival),
      plannedBerthTime: this.toIso(plannedBerth),
      actualBerthTime: this.toIso(actualBerth),
      actualUnberthTime: this.toIso(actualUnberth),
      plannedDepartureTime: this.toIso(plannedDeparture),
      actualDepartureTime: this.toIso(actualDeparture),
      totalTurnaroundMinutes: this.diffMinutes(actualArrival, actualDeparture),
      berthOccupancyMinutes: this.diffMinutes(actualBerth, actualUnberth ?? actualDeparture),
      waitingForBerthMinutes: this.diffMinutes(actualArrival, actualBerth),
      arrivalDelayMinutes: this.diffMinutes(plannedArrival, actualArrival),
      departureDelayMinutes: this.diffMinutes(plannedDeparture, actualDeparture),
      operationsDelayMinutes: null, // TODO: derive from executed operations once the model is available.
    };
  }

  private diffMinutes(start: Date | null | undefined, end: Date | null | undefined): number | null {
    if (!start || !end) {
      return null;
    }
    const delta = end.getTime() - start.getTime();
    return Math.round(delta / 60000);
  }

  private toIso(value?: Date | null): string | null {
    return value ? value.toISOString() : null;
  }

  private async ensureAllOperationsFinished(execution: VesselVisitExecutionEntity): Promise<void> {
    let plan: OperationPlanEntity | null = null;
    try {
      plan = await this.resolveOperationPlan(execution);
    } catch {
      // No associated operation plan -> nothing to validate
      return;
    }

    const tasks = await this.taskRepo.find({ where: { operationPlanId: plan.id } });
    if (!tasks.length) {
      return;
    }

    const unfinished = tasks.filter(
      (t) =>
        t.executionStatus === OperationExecutionStatus.Planned ||
        t.executionStatus === OperationExecutionStatus.Started,
    );

    if (unfinished.length > 0) {
      throw new BadRequestException(
        `Cannot complete vessel visit execution while there are unfinished cargo operations (${unfinished.length} pending).`,
      );
    }
  }

  private isAdmin(user: AuthenticatedUser | null): boolean {
    return !!user?.roles?.includes('admin');
  }

  private resolveUserId(user: AuthenticatedUser | null): string {
    if (!user) return 'unknown';
    return user.userId || user.email || 'unknown';
  }

  private ensureMutableOrAdmin(
    execution: VesselVisitExecutionEntity,
    user: AuthenticatedUser | null,
    context: string,
  ): void {
    if (execution.status === VesselExecutionStatus.Completed && !this.isAdmin(user)) {
      throw new BadRequestException(
        `Completed vessel visit executions are read-only (${context}). Contact an administrator for corrections.`,
      );
    }
  }

  private async resolveOperationPlan(
    vve: VesselVisitExecutionEntity,
  ): Promise<OperationPlanEntity> {
    if (vve.operationPlanId) {
      const byId = await this.planRepo.findOne({ where: { id: vve.operationPlanId } });
      if (byId) {
        return byId;
      }
    }

    const candidates = new Set<number>();
    const vvnCandidate = Number(vve.vvnId);
    if (!Number.isNaN(vvnCandidate)) {
      candidates.add(vvnCandidate);
    }
    const visitCandidate = Number(vve.vesselVisitId);
    if (!Number.isNaN(visitCandidate)) {
      candidates.add(visitCandidate);
    }

    for (const candidate of candidates) {
      const bySource = await this.planRepo.findOne({ where: { sourceVvnId: candidate } });
      if (bySource) {
        return bySource;
      }

      const byVisit = await this.planRepo.findOne({ where: { vesselVisitId: candidate } });
      if (byVisit) {
        return byVisit;
      }
    }

    throw new NotFoundException(
      `Operation plan could not be resolved for vessel visit execution ${vve.id}.`,
    );
  }

  private async findLatestPlannedOperationPlanForVvn(
    vvnId: number,
  ): Promise<OperationPlanEntity | null> {
    if (!Number.isFinite(vvnId)) {
      return null;
    }

    const bySource = await this.planRepo.findOne({
      where: { sourceVvnId: vvnId, status: OperationPlanStatus.Planned },
      order: { createdAt: 'DESC' },
    });

    if (bySource) {
      return bySource;
    }

    const byVisit = await this.planRepo.findOne({
      where: { vesselVisitId: vvnId, status: OperationPlanStatus.Planned },
      order: { createdAt: 'DESC' },
    });

    return byVisit ?? null;
  }

  private computeExecutionStatus(
    task: OperationPlanTaskEntity,
    actualStart: Date | null,
    actualEnd: Date | null,
  ): OperationExecutionStatus {
    if (actualEnd) {
      // Consider the operation delayed if it concluded after the planned window or started late.
      if (
        actualEnd.getTime() > task.endTime.getTime() ||
        (actualStart && actualStart.getTime() > task.startTime.getTime())
      ) {
        return OperationExecutionStatus.Delayed;
      }
      return OperationExecutionStatus.Completed;
    }

    if (actualStart) {
      // Consider the operation delayed if it started after the planned start time.
      if (actualStart.getTime() > task.startTime.getTime()) {
        return OperationExecutionStatus.Delayed;
      }
      return OperationExecutionStatus.Started;
    }

    return task.executionStatus ?? OperationExecutionStatus.Planned;
  }

  private buildExecutedOperationSnapshot(
    executed: ExecutedOperationEntity | null,
    task: OperationPlanTaskEntity,
  ): Record<string, unknown> {
    return {
      actualStartTime: executed?.actualStartTime ?? task.actualStartTime ?? null,
      actualEndTime: executed?.actualEndTime ?? task.actualEndTime ?? null,
      resourcesUsed: executed?.resourcesUsed ?? task.actualResourcesUsed ?? null,
      executionStatus: task.executionStatus ?? OperationExecutionStatus.Planned,
    };
  }

  private mapExecutedOperationDto(
    executed: ExecutedOperationEntity,
    task: OperationPlanTaskEntity | null,
  ): ExecutedOperationDto {
    return {
      plannedOperationId: executed.plannedOperationId,
      actualStartTime: executed.actualStartTime ? executed.actualStartTime.toISOString() : null,
      actualEndTime: executed.actualEndTime ? executed.actualEndTime.toISOString() : null,
      resourcesUsed: executed.resourcesUsed ?? null,
      executionStatus: task?.executionStatus ?? OperationExecutionStatus.Planned,
    };
  }
}
