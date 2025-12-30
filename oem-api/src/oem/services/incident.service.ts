import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  CreateIncidentDto,
  IncidentDto,
  IncidentQueryDto,
  SetIncidentAffectedVvesDto,
  UpdateIncidentDto,
} from '../dto';
import { AuthenticatedUser } from '../auth/types';
import { IncidentScope, IncidentStatus } from '../domain/incident.entity';
import { IncidentSeverity } from '../domain/incident-type.entity';
import { IncidentEntity } from '../persistence/incident.entity';
import { IncidentAffectedVveEntity } from '../persistence/incident-affected-vve.entity';
import { IncidentAuditEntity } from '../persistence/incident-audit.entity';
import { VesselVisitExecutionEntity } from '../persistence/vessel-visit-execution.entity';
import { IncidentTypeService } from './incident-type.service';

type ImpactComputationContext = {
  now: Date;
  ongoing?: VesselVisitExecutionEntity[];
  upcomingCache: Map<string, VesselVisitExecutionEntity[]>;
};

@Injectable()
export class IncidentService {
  private static readonly ONGOING_STATUSES = ['in-progress', 'active'];

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(IncidentEntity)
    private readonly repo: Repository<IncidentEntity>,
    @InjectRepository(IncidentAffectedVveEntity)
    private readonly affectedRepo: Repository<IncidentAffectedVveEntity>,
    @InjectRepository(IncidentAuditEntity)
    private readonly auditRepo: Repository<IncidentAuditEntity>,
    @InjectRepository(VesselVisitExecutionEntity)
    private readonly vveRepo: Repository<VesselVisitExecutionEntity>,
    private readonly incidentTypes: IncidentTypeService,
  ) {}

  async findAll(filters: IncidentQueryDto): Promise<IncidentDto[]> {
    const qb = this.repo
      .createQueryBuilder('incident')
      .leftJoinAndSelect('incident.incidentType', 'incidentType')
      .leftJoinAndSelect('incident.affectedVves', 'affected')
      .leftJoinAndSelect('affected.vve', 'affectedVve')
      .orderBy('incident.startTime', 'DESC');

    if (filters.severity) {
      qb.andWhere('incident.severity = :severity', { severity: filters.severity });
    }

    if (filters.incidentTypeId) {
      qb.andWhere('incident.incidentTypeId = :incidentTypeId', {
        incidentTypeId: filters.incidentTypeId,
      });
    }

    if (filters.scope) {
      qb.andWhere('incident.scope = :scope', { scope: filters.scope });
    }

    if (filters.status === IncidentStatus.ACTIVE) {
      qb.andWhere('incident.endTime IS NULL');
    } else if (filters.status === IncidentStatus.RESOLVED) {
      qb.andWhere('incident.endTime IS NOT NULL');
    }

    const fromDate = filters.from ? this.parseDate(filters.from, 'from') : null;
    const toDate = filters.to ? this.parseDate(filters.to, 'to') : null;

    if (fromDate) {
      qb.andWhere(
        '(incident.endTime IS NULL AND incident.startTime >= :from) OR (incident.endTime IS NOT NULL AND incident.endTime >= :from)',
        { from: fromDate },
      );
    }

    if (toDate) {
      qb.andWhere('incident.startTime <= :to', { to: toDate });
    }

    const incidents = await qb.getMany();
    const context = this.createImpactContext();
    const results: IncidentDto[] = [];

    for (const incident of incidents) {
      const impactedVves = await this.resolveImpactedVves(incident, context);
      if (
        filters.vesselIdentifier &&
        !this.matchesVesselFilter(impactedVves, filters.vesselIdentifier)
      ) {
        continue;
      }
      results.push(this.buildDto(incident, impactedVves, context.now));
    }

    return results;
  }

  async findOne(id: number): Promise<IncidentDto> {
    const incident = await this.repo.findOne({
      where: { id },
      relations: ['incidentType', 'affectedVves', 'affectedVves.vve'],
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${id} not found`);
    }

    const context = this.createImpactContext();
    const impactedVves = await this.resolveImpactedVves(incident, context);
    return this.buildDto(incident, impactedVves, context.now);
  }

  async createIncident(dto: CreateIncidentDto, user: AuthenticatedUser | null): Promise<IncidentDto> {
    await this.incidentTypes.findOne(dto.incidentTypeId);

    const startTime = this.parseDate(dto.startTime, 'startTime');
    const endTime = dto.endTime ? this.parseDate(dto.endTime, 'endTime') : null;
    this.ensureChronology(startTime, endTime);

    const impactFrom = dto.impactFrom ? this.parseDate(dto.impactFrom, 'impactFrom') : null;
    const impactTo = dto.impactTo ? this.parseDate(dto.impactTo, 'impactTo') : null;
    this.validateScope(dto.scope, impactFrom, impactTo, dto.affectedVveIds ?? []);

    const identifier = await this.generateIdentifier(startTime);
    const createdBy = this.resolveActor(user);

    const incidentId = await this.dataSource.transaction(async (manager) => {
      const incidentRepo = manager.getRepository(IncidentEntity);
      const incident = incidentRepo.create({
        identifier,
        incidentTypeId: dto.incidentTypeId,
        severity: dto.severity ?? IncidentSeverity.MINOR,
        description: dto.description ?? null,
        startTime,
        endTime,
        durationMinutes: endTime ? this.computeDurationMinutes(startTime, endTime) : null,
        scope: dto.scope,
        impactFrom: dto.scope === IncidentScope.UPCOMING ? impactFrom : null,
        impactTo: dto.scope === IncidentScope.UPCOMING ? impactTo : null,
        createdBy,
      });

      const saved = await incidentRepo.save(incident);

      if (dto.scope === IncidentScope.SPECIFIC) {
        const diff = await this.syncAffectedVves(manager, saved.id, dto.affectedVveIds ?? []);
        if (diff.added.length) {
          await this.writeAudit(manager, saved.id, 'ATTACH_VVE', null, null, createdBy, this.buildAffectedNote('Added', diff.added));
        }
      }

      await this.writeAudit(
        manager,
        saved.id,
        'CREATE',
        null,
        this.serializeIncident(saved),
        createdBy,
        null,
      );

      return saved.id;
    });

    return this.findOne(incidentId);
  }

  async updateIncident(
    id: number,
    dto: UpdateIncidentDto,
    user: AuthenticatedUser | null,
  ): Promise<IncidentDto> {
    const actor = this.resolveActor(user);

    await this.dataSource.transaction(async (manager) => {
      const incidentRepo = manager.getRepository(IncidentEntity);
      const incident = await incidentRepo.findOne({
        where: { id },
        relations: ['affectedVves'],
      });

      if (!incident) {
        throw new NotFoundException(`Incident ${id} not found`);
      }

      const beforeSnapshot = this.serializeIncident(incident);
      const previousScope = incident.scope;

      if (dto.incidentTypeId) {
        await this.incidentTypes.findOne(dto.incidentTypeId);
        incident.incidentTypeId = dto.incidentTypeId;
      }

      if (dto.severity) {
        incident.severity = dto.severity;
      }

      if (dto.description !== undefined) {
        incident.description = dto.description ?? null;
      }

      if (dto.startTime) {
        incident.startTime = this.parseDate(dto.startTime, 'startTime');
      }

      if (dto.endTime !== undefined) {
        incident.endTime = dto.endTime ? this.parseDate(dto.endTime, 'endTime') : null;
      }

      this.ensureChronology(incident.startTime, incident.endTime ?? null);
      incident.durationMinutes = incident.endTime
        ? this.computeDurationMinutes(incident.startTime, incident.endTime)
        : null;

      if (dto.scope) {
        incident.scope = dto.scope;
      }

      if (incident.scope === IncidentScope.UPCOMING) {
        const impactFrom = dto.impactFrom !== undefined
          ? dto.impactFrom
            ? this.parseDate(dto.impactFrom, 'impactFrom')
            : null
          : incident.impactFrom ?? null;
        const impactTo = dto.impactTo !== undefined
          ? dto.impactTo
            ? this.parseDate(dto.impactTo, 'impactTo')
            : null
          : incident.impactTo ?? null;
        this.validateUpcomingWindow(impactFrom, impactTo);
        incident.impactFrom = impactFrom;
        incident.impactTo = impactTo;
      } else {
        incident.impactFrom = null;
        incident.impactTo = null;
      }

      if (incident.scope === IncidentScope.SPECIFIC) {
        const currentIds = incident.affectedVves?.map((item) => item.vveId) ?? [];
        if (currentIds.length === 0) {
          throw new BadRequestException(
            'SPECIFIC scope incidents must have at least one affected VVE. Ensure vessels are attached before updating.',
          );
        }
      }

      const saved = await incidentRepo.save(incident);

      if (previousScope === IncidentScope.SPECIFIC && saved.scope !== IncidentScope.SPECIFIC) {
        const diff = await this.syncAffectedVves(manager, saved.id, []);
        if (diff.removed.length) {
          await this.writeAudit(manager, saved.id, 'DETACH_VVE', null, null, actor, this.buildAffectedNote('Removed', diff.removed));
        }
      }

      const afterSnapshot = this.serializeIncident(saved);
      const action = !beforeSnapshot.endTime && afterSnapshot.endTime ? 'RESOLVE' : 'UPDATE';

      await this.writeAudit(manager, saved.id, action, beforeSnapshot, afterSnapshot, actor, null);
    });

    return this.findOne(id);
  }

  async remove(id: number, user: AuthenticatedUser | null): Promise<void> {
    const actor = this.resolveActor(user);

    await this.dataSource.transaction(async (manager) => {
      const incidentRepo = manager.getRepository(IncidentEntity);
      const incident = await incidentRepo.findOne({ where: { id } });

      if (!incident) {
        throw new NotFoundException(`Incident ${id} not found`);
      }

      const beforeSnapshot = this.serializeIncident(incident);
      await this.writeAudit(manager, id, 'DELETE', beforeSnapshot, null, actor, null);
      await incidentRepo.delete(id);
    });
  }

  async replaceAffectedVves(
    id: number,
    dto: SetIncidentAffectedVvesDto,
    user: AuthenticatedUser | null,
  ): Promise<IncidentDto> {
    const actor = this.resolveActor(user);

    await this.dataSource.transaction(async (manager) => {
      const incident = await manager.getRepository(IncidentEntity).findOne({
        where: { id },
        relations: ['affectedVves'],
      });

      if (!incident) {
        throw new NotFoundException(`Incident ${id} not found`);
      }

      if (incident.scope !== IncidentScope.SPECIFIC) {
        throw new BadRequestException('Incident scope must be SPECIFIC to manage affected VVEs.');
      }

      const diff = await this.syncAffectedVves(manager, id, dto.vveIds);

      if (diff.added.length) {
        await this.writeAudit(manager, id, 'ATTACH_VVE', null, null, actor, this.buildAffectedNote('Added', diff.added));
      }

      if (diff.removed.length) {
        await this.writeAudit(manager, id, 'DETACH_VVE', null, null, actor, this.buildAffectedNote('Removed', diff.removed));
      }
    });

    return this.findOne(id);
  }

  async addAffectedVve(id: number, vveId: number, user: AuthenticatedUser | null): Promise<IncidentDto> {
    const actor = this.resolveActor(user);

    await this.dataSource.transaction(async (manager) => {
      const incident = await manager.getRepository(IncidentEntity).findOne({
        where: { id },
        relations: ['affectedVves'],
      });

      if (!incident) {
        throw new NotFoundException(`Incident ${id} not found`);
      }

      if (incident.scope !== IncidentScope.SPECIFIC) {
        throw new BadRequestException('Incident scope must be SPECIFIC to manage affected VVEs.');
      }

      const currentIds = new Set(incident.affectedVves?.map((item) => item.vveId) ?? []);
      if (currentIds.has(vveId)) {
        return;
      }

      const diff = await this.syncAffectedVves(manager, id, [...currentIds, vveId]);

      if (diff.added.length) {
        await this.writeAudit(manager, id, 'ATTACH_VVE', null, null, actor, this.buildAffectedNote('Added', diff.added));
      }
    });

    return this.findOne(id);
  }

  async removeAffectedVve(id: number, vveId: number, user: AuthenticatedUser | null): Promise<IncidentDto> {
    const actor = this.resolveActor(user);

    await this.dataSource.transaction(async (manager) => {
      const incident = await manager.getRepository(IncidentEntity).findOne({
        where: { id },
        relations: ['affectedVves'],
      });

      if (!incident) {
        throw new NotFoundException(`Incident ${id} not found`);
      }

      if (incident.scope !== IncidentScope.SPECIFIC) {
        throw new BadRequestException('Incident scope must be SPECIFIC to manage affected VVEs.');
      }

      const remainingIds = (incident.affectedVves ?? []).map((item) => item.vveId).filter((existing) => existing !== vveId);

      if (remainingIds.length === (incident.affectedVves ?? []).length) {
        return;
      }

      if (remainingIds.length === 0) {
        throw new BadRequestException(
          'SPECIFIC scope incidents must retain at least one affected VVE. Attach a replacement before removing the final one.',
        );
      }

      const diff = await this.syncAffectedVves(manager, id, remainingIds);

      if (diff.removed.length) {
        await this.writeAudit(manager, id, 'DETACH_VVE', null, null, actor, this.buildAffectedNote('Removed', diff.removed));
      }
    });

    return this.findOne(id);
  }

  private createImpactContext(): ImpactComputationContext {
    return {
      now: new Date(),
      ongoing: undefined,
      upcomingCache: new Map<string, VesselVisitExecutionEntity[]>(),
    };
  }

  private buildDto(
    incident: IncidentEntity,
    impactedVves: VesselVisitExecutionEntity[],
    now: Date,
  ): IncidentDto {
    const status = incident.endTime ? IncidentStatus.RESOLVED : IncidentStatus.ACTIVE;
    const affectedVveIds = incident.affectedVves?.map((item) => item.vveId) ?? null;
    const isImpactingNow = this.computeIsImpactingNow(incident, impactedVves, now);

    return {
      id: incident.id,
      identifier: incident.identifier,
      incidentTypeId: incident.incidentTypeId,
      incidentType: incident.incidentType
        ? {
            id: incident.incidentType.id,
            code: incident.incidentType.code,
            name: incident.incidentType.name,
          }
        : null,
      severity: incident.severity,
      description: incident.description ?? null,
      startTime: incident.startTime,
      endTime: incident.endTime ?? null,
      durationMinutes: incident.durationMinutes ?? null,
      scope: incident.scope,
      impactFrom: incident.impactFrom ?? null,
      impactTo: incident.impactTo ?? null,
      createdBy: incident.createdBy,
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
      status,
      isImpactingNow,
      affectedVveIds,
    };
  }

  private async resolveImpactedVves(
    incident: IncidentEntity,
    context: ImpactComputationContext,
  ): Promise<VesselVisitExecutionEntity[]> {
    switch (incident.scope) {
      case IncidentScope.SPECIFIC: {
        return (incident.affectedVves ?? []).map((relation) => relation.vve).filter((vve): vve is VesselVisitExecutionEntity => Boolean(vve));
      }
      case IncidentScope.ALL_ONGOING: {
        if (!context.ongoing) {
          context.ongoing = await this.vveRepo.find({
            where: {
              status: In(IncidentService.ONGOING_STATUSES),
            },
          });
        }
        return context.ongoing;
      }
      case IncidentScope.UPCOMING: {
        if (!incident.impactFrom || !incident.impactTo) {
          return [];
        }
        const key = `${incident.impactFrom.toISOString()}|${incident.impactTo.toISOString()}`;
        if (!context.upcomingCache.has(key)) {
          const impacted = await this.vveRepo
            .createQueryBuilder('vve')
            .where(
              'COALESCE(vve.planned_arrival_time, vve.eta) BETWEEN :from AND :to',
              {
                from: incident.impactFrom,
                to: incident.impactTo,
              },
            )
            .getMany();
          context.upcomingCache.set(key, impacted);
        }
        return context.upcomingCache.get(key) ?? [];
      }
      default:
        return [];
    }
  }

  private computeIsImpactingNow(
    incident: IncidentEntity,
    impactedVves: VesselVisitExecutionEntity[],
    now: Date,
  ): boolean {
    if (incident.scope === IncidentScope.UPCOMING) {
      if (!incident.impactFrom || !incident.impactTo) {
        return false;
      }
      return now >= incident.impactFrom && now <= incident.impactTo;
    }

    return impactedVves.some((vve) => this.isVveOngoing(vve));
  }

  private isVveOngoing(vve: VesselVisitExecutionEntity): boolean {
    return IncidentService.ONGOING_STATUSES.includes(vve.status);
  }

  private matchesVesselFilter(
    impactedVves: VesselVisitExecutionEntity[],
    vesselIdentifier: string,
  ): boolean {
    const normalized = vesselIdentifier.trim().toLowerCase();

    return impactedVves.some((vve) => {
      const candidates = [vve.vesselIdentifier, vve.identifier, vve.vesselName]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase());
      return candidates.includes(normalized);
    });
  }

  private parseDate(value: string, field: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ISO-8601 date supplied for "${field}".`);
    }
    return parsed;
  }

  private ensureChronology(startTime: Date, endTime: Date | null): void {
    if (endTime && endTime < startTime) {
      throw new BadRequestException('endTime must be greater than or equal to startTime.');
    }
  }

  private computeDurationMinutes(startTime: Date, endTime: Date): number {
    const diffMs = endTime.getTime() - startTime.getTime();
    return Math.max(0, Math.round(diffMs / 60000));
  }

  private validateScope(
    scope: IncidentScope,
    impactFrom: Date | null,
    impactTo: Date | null,
    affectedVveIds: number[],
  ): void {
    if (scope === IncidentScope.UPCOMING) {
      this.validateUpcomingWindow(impactFrom, impactTo);
    }

    if (scope !== IncidentScope.UPCOMING && (impactFrom || impactTo)) {
      throw new BadRequestException('impactFrom and impactTo are only allowed for UPCOMING scope incidents.');
    }

    if (scope === IncidentScope.SPECIFIC && affectedVveIds.length === 0) {
      throw new BadRequestException('SPECIFIC scope incidents must reference at least one affected VVE.');
    }
  }

  private validateUpcomingWindow(impactFrom: Date | null, impactTo: Date | null): void {
    if (!impactFrom || !impactTo) {
      throw new BadRequestException('impactFrom and impactTo are required for UPCOMING scope incidents.');
    }

    if (impactTo < impactFrom) {
      throw new BadRequestException('impactTo must be greater than or equal to impactFrom.');
    }
  }

  private async generateIdentifier(startTime: Date): Promise<string> {
    const year = startTime.getUTCFullYear();
    const base = `INC-${year}`;
    let counter = 1;
    let candidate = `${base}-${counter.toString().padStart(4, '0')}`;

    while (await this.repo.exist({ where: { identifier: candidate } })) {
      counter += 1;
      candidate = `${base}-${counter.toString().padStart(4, '0')}`;
      if (counter > 9999) {
        candidate = `${base}-${Date.now()}`;
        break;
      }
    }

    return candidate;
  }

  private serializeIncident(incident: IncidentEntity): Record<string, unknown> {
    return {
      id: incident.id,
      identifier: incident.identifier,
      incidentTypeId: incident.incidentTypeId,
      severity: incident.severity,
      description: incident.description ?? null,
      startTime: incident.startTime?.toISOString() ?? null,
      endTime: incident.endTime?.toISOString() ?? null,
      durationMinutes: incident.durationMinutes ?? null,
      scope: incident.scope,
      impactFrom: incident.impactFrom?.toISOString() ?? null,
      impactTo: incident.impactTo?.toISOString() ?? null,
      createdBy: incident.createdBy,
      createdAt: incident.createdAt?.toISOString() ?? null,
      updatedAt: incident.updatedAt?.toISOString() ?? null,
    };
  }

  private async writeAudit(
    manager: EntityManager,
    incidentId: number,
    action: string,
    before: Record<string, unknown> | IncidentEntity | null,
    after: Record<string, unknown> | IncidentEntity | null,
    changedBy: string,
    note: string | null,
  ): Promise<void> {
    const auditRepo = manager.getRepository(IncidentAuditEntity);
    await auditRepo.save(
      auditRepo.create({
        incidentId,
        action,
        changedBy,
        before: before ? JSON.stringify(before) : null,
        after: after ? JSON.stringify(after) : null,
        note,
      }),
    );
  }

  private resolveActor(user: AuthenticatedUser | null | undefined): string {
    return (
      user?.email?.trim() ||
      user?.userId?.trim() ||
      user?.name?.trim() ||
      'system'
    );
  }

  private async syncAffectedVves(
    manager: EntityManager,
    incidentId: number,
    targetIds: number[],
  ): Promise<{ added: number[]; removed: number[] }> {
    const uniqueIds = Array.from(new Set(targetIds));

    if (uniqueIds.length) {
      const existingVves = await manager
        .getRepository(VesselVisitExecutionEntity)
        .find({ where: { id: In(uniqueIds) } });
      if (existingVves.length !== uniqueIds.length) {
        throw new BadRequestException('One or more provided VVE identifiers do not exist.');
      }
    }

    const relationRepo = manager.getRepository(IncidentAffectedVveEntity);
    const existingRelations = await relationRepo.find({ where: { incidentId } });

    const existingSet = new Set(existingRelations.map((relation) => relation.vveId));
    const targetSet = new Set(uniqueIds);

    const toAdd = uniqueIds.filter((idValue) => !existingSet.has(idValue));
    const toRemove = existingRelations.filter((relation) => !targetSet.has(relation.vveId));

    if (toAdd.length) {
      await relationRepo.insert(
        toAdd.map((value) => ({ incidentId, vveId: value })),
      );
    }

    if (toRemove.length) {
      await relationRepo.remove(toRemove);
    }

    return { added: toAdd, removed: toRemove.map((relation) => relation.vveId) };
  }

  private buildAffectedNote(prefix: string, vveIds: number[]): string | null {
    if (!vveIds.length) {
      return null;
    }
    return `${prefix} VVE IDs: ${vveIds.join(', ')}`;
  }
}
