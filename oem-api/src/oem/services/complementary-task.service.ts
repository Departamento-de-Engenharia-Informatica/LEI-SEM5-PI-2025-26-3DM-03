import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateComplementaryTaskDto, UpdateComplementaryTaskDto } from '../dto';
import { ComplementaryTaskStatus } from '../domain';
import { ComplementaryTaskCategoryService } from './complementary-task-category.service';
import { ComplementaryTaskEntity } from '../persistence/complementary-task.entity';
import { OperationPlanEntity } from '../persistence/operation-plan.entity';

@Injectable()
export class ComplementaryTaskService {
  constructor(
    @InjectRepository(ComplementaryTaskEntity)
    private readonly repo: Repository<ComplementaryTaskEntity>,
    @InjectRepository(OperationPlanEntity)
    private readonly planRepo: Repository<OperationPlanEntity>,
    private readonly categories: ComplementaryTaskCategoryService,
  ) {}

  findAll(): Promise<ComplementaryTaskEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<ComplementaryTaskEntity> {
    const task = await this.repo.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Complementary task ${id} not found`);
    }
    return task;
  }

  async createTask(dto: CreateComplementaryTaskDto): Promise<ComplementaryTaskEntity> {
    if (dto.categoryId) {
      await this.categories.findOne(dto.categoryId);
    }

    if (dto.operationPlanId) {
      await this.ensureOperationPlan(dto.operationPlanId);
    }

    const entity = this.repo.create({
      title: dto.title,
      description: dto.description,
      categoryId: dto.categoryId,
      operationPlanId: dto.operationPlanId,
      status: dto.status ?? ComplementaryTaskStatus.Pending,
      assigneeId: dto.assigneeId,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });

    return this.repo.save(entity);
  }

  async updateTask(
    id: string,
    dto: UpdateComplementaryTaskDto,
  ): Promise<ComplementaryTaskEntity> {
    const existing = await this.findOne(id);

    if (dto.categoryId) {
      await this.categories.findOne(dto.categoryId);
    }

    if (dto.operationPlanId) {
      await this.ensureOperationPlan(dto.operationPlanId);
    }

    const merged = this.repo.merge(existing, {
      ...dto,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : existing.dueDate,
    });
    return this.repo.save(merged);
  }

  async remove(id: string): Promise<ComplementaryTaskEntity> {
    const existing = await this.findOne(id);
    await this.repo.remove(existing);
    return existing;
  }

  private async ensureOperationPlan(operationPlanId: string): Promise<void> {
    const exists = await this.planRepo.exist({ where: { id: operationPlanId } });
    if (!exists) {
      throw new NotFoundException(`Operation plan ${operationPlanId} not found`);
    }
  }
}
