import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateComplementaryTaskCategoryDto, UpdateComplementaryTaskCategoryDto } from '../dto';
import { ComplementaryTaskCategoryQueryDto } from '../dto/complementary-task-category-query.dto';
import { ComplementaryTaskCategoryEntity } from '../persistence/complementary-task-category.entity';

@Injectable()
export class ComplementaryTaskCategoryService {
  constructor(
    @InjectRepository(ComplementaryTaskCategoryEntity)
    private readonly repo: Repository<ComplementaryTaskCategoryEntity>,
  ) {}

  async findAll(filters: ComplementaryTaskCategoryQueryDto = {} as ComplementaryTaskCategoryQueryDto): Promise<ComplementaryTaskCategoryEntity[]> {
    const qb = this.repo.createQueryBuilder('category').orderBy('category.name', 'ASC');

    if (filters.q) {
      const like = `%${filters.q.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(category.code) LIKE :like OR LOWER(category.name) LIKE :like OR LOWER(category.description) LIKE :like)',
        { like },
      );
    }

    return qb.getMany();
  }

  async findOne(id: number): Promise<ComplementaryTaskCategoryEntity> {
    const category = await this.repo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Complementary task category ${id} not found`);
    }
    return category;
  }

  async createCategory(
    dto: CreateComplementaryTaskCategoryDto,
  ): Promise<ComplementaryTaskCategoryEntity> {
    await this.ensureCodeIsUnique(dto.code);

    const entity = this.repo.create({
      code: dto.code,
      name: dto.name,
      description: dto.description,
      defaultDurationMinutes: dto.defaultDurationMinutes ?? null,
    });
    return this.repo.save(entity);
  }

  async updateCategory(
    id: number,
    dto: UpdateComplementaryTaskCategoryDto,
  ): Promise<ComplementaryTaskCategoryEntity> {
    const existing = await this.findOne(id);
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

    if (dto.defaultDurationMinutes !== undefined) {
      existing.defaultDurationMinutes = dto.defaultDurationMinutes;
    }

    return this.repo.save(existing);
  }

  async remove(id: number): Promise<ComplementaryTaskCategoryEntity> {
    const existing = await this.findOne(id);
    await this.repo.remove(existing);
    return existing;
  }

  private async ensureCodeIsUnique(code: string, ignoreId?: number): Promise<void> {
    const existing = await this.repo.findOne({ where: { code } });
    if (existing && existing.id !== ignoreId) {
      throw new ConflictException(`Complementary task category code ${code} already exists`);
    }
  }
}
