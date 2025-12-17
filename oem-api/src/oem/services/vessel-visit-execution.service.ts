import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateVesselVisitExecutionDto, UpdateVesselVisitExecutionDto } from '../dto';
import { VesselExecutionStatus } from '../domain';
import { VesselVisitExecutionEntity } from '../persistence/vessel-visit-execution.entity';
import { OemVvnService } from '../vvn/oem-vvn.service';

@Injectable()
export class VesselVisitExecutionService {
  constructor(
    @InjectRepository(VesselVisitExecutionEntity)
    private readonly repo: Repository<VesselVisitExecutionEntity>,
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
  ): Promise<VesselVisitExecutionEntity> {
    const existing = await this.findOne(id);
    let eta = existing.eta;
    let etd = existing.etd;
    let vesselIdentifier = existing.vesselIdentifier;
    let vvnId = existing.vvnId;
    let identifier = existing.identifier;

    if (dto.vvnId && dto.vvnId !== existing.vvnId) {
      const vvn = await this.vvnService.getById(dto.vvnId);
      vvnId = this.normalizeVvnId(vvn, dto.vvnId);
      vesselIdentifier = vvn.vesselName;
      eta = vvn.eta;
      etd = vvn.etd;
      identifier = await this.generateIdentifier(vvnId);
    }

    const merged = this.repo.merge(existing, {
      identifier,
      vvnId,
      vesselIdentifier: dto.vesselIdentifier?.trim() || vesselIdentifier,
      eta,
      etd,
      actualArrivalTime: dto.actualArrivalTime
        ? this.toDate(dto.actualArrivalTime, 'actualArrivalTime')
        : existing.actualArrivalTime,
      status: dto.status ?? existing.status,
    });

    return this.repo.save(merged);
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
}
