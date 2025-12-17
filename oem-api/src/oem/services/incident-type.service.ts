import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateIncidentTypeDto, UpdateIncidentTypeDto } from '../dto';
import { IncidentSeverity } from '../domain';
import { IncidentTypeEntity } from '../persistence/incident-type.entity';

@Injectable()
export class IncidentTypeService {
  constructor(
    @InjectRepository(IncidentTypeEntity)
    private readonly repo: Repository<IncidentTypeEntity>,
  ) {}

  findAll(): Promise<IncidentTypeEntity[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<IncidentTypeEntity> {
    const type = await this.repo.findOne({ where: { id } });
    if (!type) {
      throw new NotFoundException(`Incident type ${id} not found`);
    }
    return type;
  }

  async createType(dto: CreateIncidentTypeDto): Promise<IncidentTypeEntity> {
    const entity = this.repo.create({
      name: dto.name,
      description: dto.description,
      severity: dto.severity ?? IncidentSeverity.Low,
    });
    return this.repo.save(entity);
  }

  async updateType(id: number, dto: UpdateIncidentTypeDto): Promise<IncidentTypeEntity> {
    const existing = await this.findOne(id);
    const merged = this.repo.merge(existing, dto);
    return this.repo.save(merged);
  }

  async remove(id: number): Promise<IncidentTypeEntity> {
    const existing = await this.findOne(id);
    await this.repo.remove(existing);
    return existing;
  }
}
