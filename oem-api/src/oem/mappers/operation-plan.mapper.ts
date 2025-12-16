import { Repository } from 'typeorm';
import { OperationPlanStatus } from '../domain';
import { OperationPlanEntity, PlanOperation } from '../persistence/operation-plan.entity';
import { OperationPlanTaskEntity } from '../persistence/operation-plan-task.entity';
import { CreateOperationPlanDto, OperationPlanTaskDto, UpdateOperationPlanDto } from '../dto';

export class OperationPlanMapper {
  static toPersistenceFromCreate(dto: CreateOperationPlanDto): Partial<OperationPlanEntity> {
    const operations: PlanOperation[] | undefined = dto.operations
      ? dto.operations.map((op) => ({
          resourceId: op.resourceId,
          resourceType: op.resourceType,
          operationType: op.operationType,
          startTime: op.startTime ? new Date(op.startTime) : undefined,
          endTime: op.endTime ? new Date(op.endTime) : undefined,
        }))
      : undefined;

    return {
      name: dto.name,
      description: dto.description,
      vesselVisitId: dto.vesselVisitId != null ? Number(dto.vesselVisitId) : undefined,
      sourceVvnId: dto.sourceVvnId != null ? Number(dto.sourceVvnId) : undefined,
      dockId: dto.dockId,
      shiftDate: dto.shiftDate ? new Date(dto.shiftDate) : undefined,
      targetDay: dto.targetDay ? new Date(dto.targetDay) : undefined,
      plannedStartTime: dto.plannedStartTime ? new Date(dto.plannedStartTime) : undefined,
      plannedEndTime: dto.plannedEndTime ? new Date(dto.plannedEndTime) : undefined,
      algorithmUsed: dto.algorithmUsed,
      createdBy: dto.createdBy,
      operations,
      status: dto.status ?? OperationPlanStatus.Draft,
    };
  }

  static buildCandidatePlan(
    existing: OperationPlanEntity,
    dto: UpdateOperationPlanDto,
  ): Partial<OperationPlanEntity> {
    return {
      id: existing.id,
      dockId: dto.dockId ?? existing.dockId,
      sourceVvnId:
        dto.sourceVvnId != null
          ? Number(dto.sourceVvnId)
          : existing.sourceVvnId != null
            ? Number(existing.sourceVvnId)
            : undefined,
      plannedStartTime: dto.plannedStartTime
        ? new Date(dto.plannedStartTime)
        : existing.plannedStartTime,
      plannedEndTime: dto.plannedEndTime ? new Date(dto.plannedEndTime) : existing.plannedEndTime,
      shiftDate: dto.shiftDate ? new Date(dto.shiftDate) : existing.shiftDate,
      targetDay: dto.targetDay ? new Date(dto.targetDay) : existing.targetDay,
      algorithmUsed: dto.algorithmUsed ?? existing.algorithmUsed,
      status: dto.status ?? existing.status,
    };
  }

  static applyUpdateDto(
    existing: OperationPlanEntity,
    dto: UpdateOperationPlanDto,
    warnings: string[],
    updatedBy?: string,
  ): Partial<OperationPlanEntity> {
    const operations: PlanOperation[] | undefined = dto.operations
      ? dto.operations.map((op) => ({
          resourceId: op.resourceId,
          resourceType: op.resourceType,
          operationType: op.operationType,
          startTime: op.startTime ? new Date(op.startTime) : undefined,
          endTime: op.endTime ? new Date(op.endTime) : undefined,
        }))
      : existing.operations;

    return {
      ...dto,
      dockId: dto.dockId ?? existing.dockId,
      sourceVvnId:
        dto.sourceVvnId != null
          ? Number(dto.sourceVvnId)
          : existing.sourceVvnId != null
            ? Number(existing.sourceVvnId)
            : undefined,
      plannedStartTime: dto.plannedStartTime
        ? new Date(dto.plannedStartTime)
        : existing.plannedStartTime,
      plannedEndTime: dto.plannedEndTime ? new Date(dto.plannedEndTime) : existing.plannedEndTime,
      shiftDate: dto.shiftDate ? new Date(dto.shiftDate) : existing.shiftDate,
      targetDay: dto.targetDay ? new Date(dto.targetDay) : existing.targetDay,
      operations,
      lastUpdatedBy: updatedBy ?? existing.lastUpdatedBy,
      lastChangeReason: dto.reason ?? existing.lastChangeReason,
      lastChangeWarnings: warnings,
    } as Partial<OperationPlanEntity>;
  }

  static normalizeTasksForUpdate(
    existing: OperationPlanEntity,
    dto: UpdateOperationPlanDto,
    taskRepo: Repository<OperationPlanTaskEntity>,
  ): OperationPlanTaskEntity[] {
    const source = (dto.tasks ?? existing.tasks ?? []) as Array<
      OperationPlanTaskDto | OperationPlanTaskEntity
    >;

    return source.map((task) => {
      const start = task.startTime instanceof Date ? task.startTime : new Date(task.startTime);
      const end = task.endTime instanceof Date ? task.endTime : new Date(task.endTime);

      return taskRepo.create({
        id: (task as OperationPlanTaskEntity).id ?? (task as OperationPlanTaskDto).id,
        operationPlanId: existing.id,
        type: task.type,
        craneId: task.craneId,
        storageAreaId: task.storageAreaId,
        staffIds: task.staffIds?.filter(Boolean),
        startTime: start,
        endTime: end,
      });
    });
  }
}
