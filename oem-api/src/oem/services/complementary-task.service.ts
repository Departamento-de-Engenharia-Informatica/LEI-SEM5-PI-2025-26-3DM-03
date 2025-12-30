import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import {
  ComplementaryTaskQueryDto,
  ComplementaryTaskResponseDto,
  CreateComplementaryTaskDto,
  UpdateComplementaryTaskDto,
} from '../dto';
import {
  ComplementaryTaskMode,
  ComplementaryTaskStatus,
} from '../domain/complementary-task.entity';
import { ComplementaryTaskEntity } from '../persistence/complementary-task.entity';
import { ComplementaryTaskCategoryEntity } from '../persistence/complementary-task-category.entity';
import { VesselVisitExecutionEntity } from '../persistence/vessel-visit-execution.entity';
import { ComplementaryTaskAuditEntity } from '../persistence/complementary-task-audit.entity';
import { AuthenticatedUser } from '../auth/types';
import { deriveTaskStatus, isImpactingNow as isImpactingNowHelper } from '../complementary-tasks/complementary-task.utils';

type QueryableTask = ComplementaryTaskEntity & { vve?: VesselVisitExecutionEntity | null };

@Injectable()
export class ComplementaryTaskService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ComplementaryTaskEntity)
    private readonly repo: Repository<ComplementaryTaskEntity>,
  ) {}

  async findAll(filters: ComplementaryTaskQueryDto): Promise<ComplementaryTaskResponseDto[]> {
    const qb = this.buildBaseQuery();
    this.applyFilters(qb, filters);
    qb.orderBy('task.startTime', 'DESC');

    const tasks = await qb.getMany();
    return tasks.map((task) => this.buildResponse(task));
  }

  async findOne(id: number): Promise<ComplementaryTaskResponseDto> {
    const qb = this.buildBaseQuery();
    qb.where('task.id = :id', { id });

    const task = await qb.getOne();
    if (!task) {
      throw new NotFoundException(`Complementary task ${id} not found`);
    }

    return this.buildResponse(task);
  }

  async create(
    dto: CreateComplementaryTaskDto,
    user: AuthenticatedUser | null,
  ): Promise<ComplementaryTaskResponseDto> {
    const actor = this.resolveActor(user);
    const startTime = this.parseDate(dto.startTime, 'startTime');
    const endTime = dto.endTime ? this.parseDate(dto.endTime, 'endTime') : null;
    this.ensureChronology(startTime, endTime);

    const taskId = await this.dataSource.transaction(async (manager) => {
      await this.ensureCategory(dto.categoryId, manager);
      await this.ensureVve(dto.vveId, manager);

      const identifier = await this.generateIdentifier(manager, startTime);
      const entity = manager.getRepository(ComplementaryTaskEntity).create({
        identifier,
        categoryId: dto.categoryId,
        vveId: dto.vveId,
        team: dto.team.trim(),
        mode: dto.mode,
        startTime,
        endTime,
        durationMinutes: endTime ? this.computeDurationMinutes(startTime, endTime) : null,
        createdBy: actor,
      });

      const saved = await manager.getRepository(ComplementaryTaskEntity).save(entity);

      await this.writeAudit(manager, saved.id, 'CREATE', null, this.serialize(saved), actor, null);

      return saved.id;
    });

    return this.findOne(taskId);
  }

  async update(
    id: number,
    dto: UpdateComplementaryTaskDto,
    user: AuthenticatedUser | null,
  ): Promise<ComplementaryTaskResponseDto> {
    const actor = this.resolveActor(user);

    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ComplementaryTaskEntity);
      const existing = await repository.findOne({ where: { id } });

      if (!existing) {
        throw new NotFoundException(`Complementary task ${id} not found`);
      }

      if (dto.categoryId !== undefined && dto.categoryId !== existing.categoryId) {
        await this.ensureCategory(dto.categoryId, manager);
        existing.categoryId = dto.categoryId;
      }

      if (dto.team !== undefined) {
        existing.team = dto.team.trim();
      }

      if (dto.mode !== undefined) {
        existing.mode = dto.mode;
      }

      const nextStartTime = dto.startTime
        ? this.parseDate(dto.startTime, 'startTime')
        : existing.startTime;

      const hasEndTimeUpdate = dto.endTime !== undefined;
      const nextEndTime = hasEndTimeUpdate
        ? dto.endTime
          ? this.parseDate(dto.endTime, 'endTime')
          : null
        : existing.endTime ?? null;

      this.ensureChronology(nextStartTime, nextEndTime);

      const beforeSnapshot = this.serialize(existing);

      existing.startTime = nextStartTime;
      existing.endTime = nextEndTime;
      existing.durationMinutes = nextEndTime
        ? this.computeDurationMinutes(nextStartTime, nextEndTime)
        : null;

      const saved = await repository.save(existing);

      const afterSnapshot = this.serialize(saved);
      const transitionedToComplete =
        beforeSnapshot.endTime === null && afterSnapshot.endTime !== null;
      const action = transitionedToComplete ? 'COMPLETE' : 'UPDATE';

      await this.writeAudit(manager, saved.id, action, beforeSnapshot, afterSnapshot, actor, null);
    });

    return this.findOne(id);
  }

  async remove(id: number, user: AuthenticatedUser | null): Promise<void> {
    const actor = this.resolveActor(user);

    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ComplementaryTaskEntity);
      const existing = await repository.findOne({ where: { id } });

      if (!existing) {
        throw new NotFoundException(`Complementary task ${id} not found`);
      }

      const beforeSnapshot = this.serialize(existing);
      await repository.remove(existing);

      await this.writeAudit(manager, id, 'DELETE', beforeSnapshot, null, actor, null);
    });
  }

  private buildBaseQuery(): SelectQueryBuilder<QueryableTask> {
    return this.repo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.vve', 'vve');
  }

  private applyFilters(qb: SelectQueryBuilder<QueryableTask>, filters: ComplementaryTaskQueryDto): void {
    if (filters.vveId !== undefined) {
      qb.andWhere('task.vveId = :vveId', { vveId: filters.vveId });
    }

    if (filters.status === ComplementaryTaskStatus.ONGOING) {
      qb.andWhere('task.endTime IS NULL');
    } else if (filters.status === ComplementaryTaskStatus.COMPLETED) {
      qb.andWhere('task.endTime IS NOT NULL');
    }

    if (filters.vesselIdentifier) {
      const normalized = filters.vesselIdentifier.trim().toLowerCase();
      qb.andWhere('LOWER(vve.vesselIdentifier) = :vesselIdentifier', {
        vesselIdentifier: normalized,
      });
    }

    const fromDate = filters.from ? this.parseDate(filters.from, 'from') : null;
    const toDate = filters.to ? this.parseDate(filters.to, 'to') : null;

    if (fromDate) {
      qb.andWhere('(task.endTime IS NULL OR task.endTime >= :from)', { from: fromDate });
    }

    if (toDate) {
      qb.andWhere('task.startTime <= :to', { to: toDate });
    }
  }

  private ensureChronology(startTime: Date, endTime: Date | null): void {
    if (endTime && endTime.getTime() < startTime.getTime()) {
      throw new BadRequestException('endTime must be greater than or equal to startTime.');
    }
  }

  private parseDate(value: string, field: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ISO-8601 date supplied for "${field}".`);
    }
    return parsed;
  }

  private async ensureCategory(categoryId: number, manager: EntityManager): Promise<void> {
    const exists = await manager
      .getRepository(ComplementaryTaskCategoryEntity)
      .exist({ where: { id: categoryId } });
    if (!exists) {
      throw new NotFoundException(`Complementary task category ${categoryId} not found`);
    }
  }

  private async ensureVve(vveId: number, manager: EntityManager): Promise<void> {
    const exists = await manager
      .getRepository(VesselVisitExecutionEntity)
      .exist({ where: { id: vveId } });
    if (!exists) {
      throw new NotFoundException(`Vessel visit execution ${vveId} not found`);
    }
  }

  private async generateIdentifier(manager: EntityManager, startTime: Date): Promise<string> {
    const year = startTime.getUTCFullYear();
    const prefix = `CT-${year}-`;

    const latest = await manager
      .getRepository(ComplementaryTaskEntity)
      .createQueryBuilder('task')
      .select('task.identifier', 'identifier')
      .where('task.identifier LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('task.identifier', 'DESC')
      .limit(1)
      .getRawOne<{ identifier?: string }>();

    const parsedSequence = latest?.identifier
      ? Number.parseInt(latest.identifier.replace(prefix, ''), 10)
      : 0;

    const nextSequence = Number.isFinite(parsedSequence) ? parsedSequence + 1 : 1;
    const padded = nextSequence.toString().padStart(4, '0');
    return `${prefix}${padded}`;
  }

  private buildResponse(entity: QueryableTask): ComplementaryTaskResponseDto {
    const status = deriveTaskStatus(entity.endTime ?? null);
    const isImpactingNow = isImpactingNowHelper(entity.mode, status);

    return {
      id: entity.id,
      identifier: entity.identifier,
      categoryId: entity.categoryId,
      vveId: entity.vveId,
      team: entity.team,
      mode: entity.mode,
      startTime: entity.startTime.toISOString(),
      endTime: entity.endTime ? entity.endTime.toISOString() : null,
      durationMinutes: entity.durationMinutes ?? null,
      status,
      isImpactingNow,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private computeDurationMinutes(startTime: Date, endTime: Date): number {
    const diffMs = endTime.getTime() - startTime.getTime();
    return Math.max(0, Math.round(diffMs / 60000));
  }

  private async writeAudit(
    manager: EntityManager,
    taskId: number,
    action: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    changedBy: string,
    note: string | null,
  ): Promise<void> {
    const repository = manager.getRepository(ComplementaryTaskAuditEntity);
    await repository.save(
      repository.create({
        taskId,
        action,
        changedBy,
        before,
        after,
        note,
      }),
    );
  }

  private serialize(entity: ComplementaryTaskEntity): Record<string, unknown> {
    return {
      id: entity.id,
      identifier: entity.identifier,
      categoryId: entity.categoryId,
      vveId: entity.vveId,
      team: entity.team,
      mode: entity.mode,
      startTime: entity.startTime.toISOString(),
      endTime: entity.endTime ? entity.endTime.toISOString() : null,
      durationMinutes: entity.durationMinutes ?? null,
      createdBy: entity.createdBy,
    };
  }

  private resolveActor(user: AuthenticatedUser | null | undefined): string {
    return (
      user?.email?.trim() ||
      user?.userId?.trim() ||
      user?.name?.trim() ||
      'system'
    );
  }
}
