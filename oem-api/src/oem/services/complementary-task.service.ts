import { Injectable } from '@nestjs/common';
import { CreateComplementaryTaskDto, UpdateComplementaryTaskDto } from '../dto';
import { ComplementaryTask, ComplementaryTaskStatus } from '../domain';
import { BaseInMemoryService } from './base-in-memory.service';

@Injectable()
export class ComplementaryTaskService extends BaseInMemoryService<
  ComplementaryTask,
  CreateComplementaryTaskDto,
  UpdateComplementaryTaskDto
> {
  createTask(dto: CreateComplementaryTaskDto): ComplementaryTask {
    return this.create(dto, (id, payload) => {
      return new ComplementaryTask({
        id,
        createdAt: new Date(),
        title: payload.title,
        description: payload.description,
        categoryId: payload.categoryId,
        operationPlanId: payload.operationPlanId,
        status: payload.status ?? ComplementaryTaskStatus.Pending,
        assigneeId: payload.assigneeId,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
      });
    });
  }

  updateTask(id: string, dto: UpdateComplementaryTaskDto): ComplementaryTask {
    return this.update(id, dto, (existing, payload) => {
      return new ComplementaryTask({
        ...existing,
        ...payload,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : existing.dueDate,
      });
    });
  }
}
