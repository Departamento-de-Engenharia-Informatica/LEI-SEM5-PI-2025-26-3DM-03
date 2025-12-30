import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateIncidentTypeDto,
  IncidentTypeDto,
  IncidentTypeQueryDto,
  IncidentTypeTreeDto,
  UpdateIncidentTypeDto,
} from '../dto';
import { IncidentTypeEntity } from '../persistence/incident-type.entity';

@Injectable()
export class IncidentTypeService {
  constructor(
    @InjectRepository(IncidentTypeEntity)
    private readonly repo: Repository<IncidentTypeEntity>,
  ) {}

  async findAll(filters: IncidentTypeQueryDto): Promise<IncidentTypeDto[]> {
    const qb = this.repo.createQueryBuilder('type');

    if (filters.parentId !== undefined && filters.parentId !== null) {
      qb.andWhere('type.parent_id = :parentId', { parentId: filters.parentId });
    }

    if (filters.severity) {
      qb.andWhere('type.severity = :severity', { severity: filters.severity });
    }

    if (filters.q) {
      const like = `%${filters.q.toLowerCase()}%`;
      qb.andWhere('(LOWER(type.code) LIKE :like OR LOWER(type.name) LIKE :like)', { like });
    }

    qb.orderBy('type.code', 'ASC');

    const items = await qb.getMany();
    return items.map((item) => this.toDto(item));
  }

  async findTree(filters: IncidentTypeQueryDto): Promise<IncidentTypeTreeDto[]> {
    const qb = this.repo.createQueryBuilder('type');

    if (filters.severity) {
      qb.andWhere('type.severity = :severity', { severity: filters.severity });
    }

    if (filters.q) {
      const like = `%${filters.q.toLowerCase()}%`;
      qb.andWhere('(LOWER(type.code) LIKE :like OR LOWER(type.name) LIKE :like)', { like });
    }

    qb.orderBy('type.code', 'ASC');

    const entities = await qb.getMany();
    if (entities.length === 0) {
      return [];
    }

    const nodes = new Map<number, IncidentTypeTreeDto>();
    for (const entity of entities) {
      nodes.set(entity.id, { ...this.toDto(entity), children: [] });
    }

    const roots: IncidentTypeTreeDto[] = [];
    for (const entity of entities) {
      const node = nodes.get(entity.id)!;
      const parentId = entity.parentId ?? null;
      if (parentId !== null && parentId !== undefined && nodes.has(parentId)) {
        nodes.get(parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }

    if (filters.parentId !== undefined && filters.parentId !== null) {
      const parentNode = nodes.get(filters.parentId);
      return parentNode ? [parentNode] : [];
    }

    return roots;
  }

  async findOne(id: number): Promise<IncidentTypeDto> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Incident type ${id} not found`);
    }
    return this.toDto(entity);
  }

  async create(dto: CreateIncidentTypeDto): Promise<IncidentTypeDto> {
    await this.ensureCodeIsUnique(dto.code);
    const parent = await this.resolveParent(null, dto.parentId ?? null);

    const entity = this.repo.create({
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      severity: dto.severity,
      parent,
    });

    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async update(id: number, dto: UpdateIncidentTypeDto): Promise<IncidentTypeDto> {
    const existing = await this.repo.findOne({ where: { id }, relations: ['parent'] });
    if (!existing) {
      throw new NotFoundException(`Incident type ${id} not found`);
    }

    if (dto.code && dto.code !== existing.code) {
      await this.ensureCodeIsUnique(dto.code, id);
      existing.code = dto.code;
    }

    if (dto.name !== undefined) {
      existing.name = dto.name;
    }

    if (dto.description !== undefined) {
      existing.description = dto.description ?? null;
    }

    if (dto.severity) {
      existing.severity = dto.severity;
    }

    if (dto.parentId !== undefined) {
      const parent = await this.resolveParent(id, dto.parentId);
      existing.parent = parent;
    }

    const saved = await this.repo.save(existing);
    return this.toDto(saved);
  }

  async remove(id: number): Promise<IncidentTypeDto> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Incident type ${id} not found`);
    }

    const childrenCount = await this.repo.count({ where: { parent: { id } } });
    if (childrenCount > 0) {
      throw new ConflictException('Cannot delete incident type with children');
    }

    await this.repo.remove(existing);
    return this.toDto(existing);
  }

  private toDto(entity: IncidentTypeEntity): IncidentTypeDto {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      description: entity.description ?? null,
      severity: entity.severity,
      parentId: entity.parentId ?? null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private async ensureCodeIsUnique(code: string, ignoreId?: number): Promise<void> {
    const existing = await this.repo.findOne({ where: { code } });
    if (existing && existing.id !== ignoreId) {
      throw new ConflictException(`Incident type code ${code} already exists`);
    }
  }

  private async resolveParent(
    selfId: number | null,
    parentId: number | null,
  ): Promise<IncidentTypeEntity | null> {
    if (parentId === null || parentId === undefined) {
      return null;
    }

    if (selfId !== null && parentId === selfId) {
      throw new BadRequestException('An incident type cannot reference itself as parent');
    }

    const parent = await this.repo.findOne({ where: { id: parentId } });
    if (!parent) {
      throw new NotFoundException(`Parent incident type ${parentId} not found`);
    }

    if (selfId !== null) {
      await this.ensureNoCircularParent(selfId, parentId);
    }

    return parent;
  }

  private async ensureNoCircularParent(childId: number, parentId: number): Promise<void> {
    let currentId: number | null = parentId;
    while (currentId) {
      if (currentId === childId) {
        throw new BadRequestException('Circular parenting detected for incident type');
      }
      const result: { parentId: number | null } | undefined = await this.repo
        .createQueryBuilder('type')
        .select('type.parent_id', 'parentId')
        .where('type.id = :id', { id: currentId })
        .getRawOne<{ parentId: number | null }>();
      currentId = result?.parentId ?? null;
    }
  }
}
