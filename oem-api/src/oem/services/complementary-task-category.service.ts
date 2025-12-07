import { Injectable } from '@nestjs/common';
import { CreateComplementaryTaskCategoryDto, UpdateComplementaryTaskCategoryDto } from '../dto';
import { ComplementaryTaskCategory } from '../domain';
import { BaseInMemoryService } from './base-in-memory.service';

@Injectable()
export class ComplementaryTaskCategoryService extends BaseInMemoryService<
  ComplementaryTaskCategory,
  CreateComplementaryTaskCategoryDto,
  UpdateComplementaryTaskCategoryDto
> {
  createCategory(dto: CreateComplementaryTaskCategoryDto): ComplementaryTaskCategory {
    return this.create(dto, (id, payload) => {
      return new ComplementaryTaskCategory({
        id,
        createdAt: new Date(),
        name: payload.name,
        description: payload.description,
      });
    });
  }

  updateCategory(id: string, dto: UpdateComplementaryTaskCategoryDto): ComplementaryTaskCategory {
    return this.update(id, dto, (existing, payload) => {
      return new ComplementaryTaskCategory({
        ...existing,
        ...payload,
      });
    });
  }
}
