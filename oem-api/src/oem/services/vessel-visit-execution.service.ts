import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CreateVesselVisitExecutionDto,
  ExecutedOperationDto,
  PlannedOperationWithExecutionDto,
  UpdateVesselVisitExecutionDto,
  UpsertExecutedOperationDto,
} from '../dto';
import { VesselExecutionStatus } from '../domain';
import { VesselVisitExecutionEntity } from '../persistence/vessel-visit-execution.entity';
import { OemVvnService } from '../vvn/oem-vvn.service';
import { VesselVisitExecutionAuditEntity } from '../persistence/vessel-visit-execution-audit.entity';
import { OperationPlanEntity } from '../persistence/operation-plan.entity';
import {
  OperationExecutionStatus,
  OperationPlanTaskEntity,
} from '../persistence/operation-plan-task.entity';
import { ExecutedOperationEntity } from '../persistence/executed-operation.entity';
import { ExecutedOperationAuditEntity } from '../persistence/executed-operation-audit.entity';

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
    createdBy: string,
  ): Promise<VesselVisitExecutionEntity> {
    const vvn = await this.vvnService.getById(dto.vvnId);
    const actualArrivalTime = this.toDate(dto.actualArrivalTime, 'actualArrivalTime');

    const normalizedVvnId = this.normalizeVvnId(vvn, dto.vvnId);
    const identifier = await this.generateIdentifier(normalizedVvnId);

    const entity = this.repo.create({
      identifier,
      vvnId: normalizedVvnId,
      vesselIdentifier: vvn.vesselName,
      voyageNumber: undefined,
      operationPlanId: undefined,
      eta: vvn.eta,
      etd: vvn.etd,
      actualArrivalTime,
      createdBy: createdBy ?? 'unknown',
      status: VesselExecutionStatus.InProgress,
    });

    return this.repo.save(entity);
  }

  async updateExecution(
    id: number,
    dto: UpdateVesselVisitExecutionDto,
    updatedBy: string,
  ): Promise<VesselVisitExecutionEntity> {
    if (!dto.actualBerthTime && !dto.dockId) {
      throw new BadRequestException('Provide at least actualBerthTime or dockId.');
    }

    const existing = await this.findOne(id);

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

    let note: string | undefined;
    let nextDockId = existing.dockId ?? null;
    let nextLastWarning = existing.lastWarning ?? null;

    if (dto.dockId) {
      nextDockId = dto.dockId.trim();
      if (plannedDock && nextDockId !== plannedDock) {
        note = `Dock mismatch: planned ${plannedDock}, actual ${nextDockId}`;
        nextLastWarning = note;
      } else {
        nextLastWarning = null;
      }
    }

    return this.repo.manager.transaction(async (manager) => {
      const vveRepo = manager.getRepository(VesselVisitExecutionEntity);
      const auditRepo = manager.getRepository(VesselVisitExecutionAuditEntity);

      existing.actualBerthTime = nextActualBerthTime ?? null;
      existing.dockId = nextDockId ?? null;
      existing.lastWarning = nextLastWarning ?? null;

      const saved = await vveRepo.save(existing);

      const auditPayload: Partial<VesselVisitExecutionAuditEntity> = {
        vveId: saved.id,
        changedBy: updatedBy || 'unknown',
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

  async getPlannedOperations(
    vveId: number,
  ): Promise<PlannedOperationWithExecutionDto[]> {
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

    return executions.map((execution) => this.mapExecutedOperationDto(
      execution,
      taskMap.get(execution.plannedOperationId) ?? null,
    ));
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

  async upsertExecutedOperation(
    vveId: number,
    plannedOperationId: number,
    dto: UpsertExecutedOperationDto,
    changedBy: string,
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

      const beforeSnapshot = this.buildExecutedOperationSnapshot(
        existingExecution ?? null,
        task,
      );

      const nextActualStartTime =
        dto.actualStartTime !== undefined
          ? this.toDate(dto.actualStartTime, 'actualStartTime')
          : existingExecution?.actualStartTime ?? task.actualStartTime ?? null;

      const nextActualEndTime =
        dto.actualEndTime !== undefined
          ? this.toDate(dto.actualEndTime, 'actualEndTime')
          : existingExecution?.actualEndTime ?? task.actualEndTime ?? null;

      if (nextActualStartTime && nextActualEndTime) {
        if (nextActualEndTime.getTime() <= nextActualStartTime.getTime()) {
          throw new BadRequestException('actualEndTime must be after actualStartTime.');
        }
      }

      const nextResourcesUsed =
        dto.resourcesUsed !== undefined
          ? (dto.resourcesUsed as Record<string, unknown>)
          : existingExecution?.resourcesUsed ?? task.actualResourcesUsed ?? null;

      const nextStatus = this.computeExecutionStatus(
        task,
        nextActualStartTime,
        nextActualEndTime,
      );

      task.actualStartTime = nextActualStartTime ?? null;
      task.actualEndTime = nextActualEndTime ?? null;
      task.actualResourcesUsed = nextResourcesUsed ?? null;
      task.executionStatus = nextStatus;

      const payload = existingExecution
        ? executedRepo.merge(existingExecution, {
            actualStartTime: nextActualStartTime ?? null,
            actualEndTime: nextActualEndTime ?? null,
            resourcesUsed: nextResourcesUsed ?? null,
            updatedBy: changedBy || 'unknown',
          })
        : executedRepo.create({
            vveId: vve.id,
            plannedOperationId,
            actualStartTime: nextActualStartTime ?? null,
            actualEndTime: nextActualEndTime ?? null,
            resourcesUsed: nextResourcesUsed ?? null,
            createdBy: changedBy || 'unknown',
            updatedBy: changedBy || 'unknown',
          });

      const savedExecution = await executedRepo.save(payload);
      await taskRepo.save(task);

      const afterSnapshot = this.buildExecutedOperationSnapshot(savedExecution, task);

      const audit = auditRepo.create({
        executedOperationId: savedExecution.id,
        changedBy: changedBy || 'unknown',
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

  private toDate(value: string, field: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ISO-8601 date supplied for "${field}".`);
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
      dockId: execution.dockId ?? null,
      status: execution.status,
      lastWarning: execution.lastWarning ?? null,
    };
  }

  private async resolveOperationPlan(vve: VesselVisitExecutionEntity): Promise<OperationPlanEntity> {
    if (vve.operationPlanId) {
      const byId = await this.planRepo.findOne({ where: { id: vve.operationPlanId } });
      if (byId) {
        return byId;
      }
    }

    const numericVvnId = Number(vve.vvnId);
    if (!Number.isNaN(numericVvnId)) {
      const bySource = await this.planRepo.findOne({ where: { sourceVvnId: numericVvnId } });
      if (bySource) {
        return bySource;
      }

      const byVisit = await this.planRepo.findOne({ where: { vesselVisitId: numericVvnId } });
      if (byVisit) {
        return byVisit;
      }
    }

    throw new NotFoundException(
      `Operation plan could not be resolved for vessel visit execution ${vve.id}.`,
    );
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
      actualStartTime: (executed?.actualStartTime ?? task.actualStartTime) ?? null,
      actualEndTime: (executed?.actualEndTime ?? task.actualEndTime) ?? null,
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
