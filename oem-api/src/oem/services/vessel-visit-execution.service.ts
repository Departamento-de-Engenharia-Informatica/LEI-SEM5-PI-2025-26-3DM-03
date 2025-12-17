import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateVesselVisitExecutionDto, UpdateVesselVisitExecutionDto } from '../dto';
import { VesselExecutionStatus } from '../domain';
import { VesselVisitExecutionEntity } from '../persistence/vessel-visit-execution.entity';
import { OemVvnService } from '../vvn/oem-vvn.service';
import { VesselVisitExecutionAuditEntity } from '../persistence/vessel-visit-execution-audit.entity';

@Injectable()
export class VesselVisitExecutionService {
  constructor(
    @InjectRepository(VesselVisitExecutionEntity)
    private readonly repo: Repository<VesselVisitExecutionEntity>,
    @InjectRepository(VesselVisitExecutionAuditEntity)
    private readonly auditRepo: Repository<VesselVisitExecutionAuditEntity>,
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
}
