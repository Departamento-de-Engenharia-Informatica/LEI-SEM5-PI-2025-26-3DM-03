import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateComplementaryTaskCategoryDto, UpdateComplementaryTaskCategoryDto } from '../dto';
import { ComplementaryTaskCategoryEntity } from '../persistence/complementary-task-category.entity';

@Injectable()
export class ComplementaryTaskCategoryService {
  constructor(
    @InjectRepository(ComplementaryTaskCategoryEntity)
    private readonly repo: Repository<ComplementaryTaskCategoryEntity>,
  ) {}

  findAll(): Promise<ComplementaryTaskCategoryEntity[]> {
    return this.repo.find({ order: { name: 'ASC' } });
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
    const entity = this.repo.create({
      name: dto.name,
      description: dto.description,
    });
    return this.repo.save(entity);
  }

  async updateCategory(
    id: number,
    dto: UpdateComplementaryTaskCategoryDto,
  ): Promise<ComplementaryTaskCategoryEntity> {
    const existing = await this.findOne(id);
    const merged = this.repo.merge(existing, dto);
    return this.repo.save(merged);
  }

  async remove(id: number): Promise<ComplementaryTaskCategoryEntity> {
    const existing = await this.findOne(id);
    await this.repo.remove(existing);
    return existing;
  }
}
