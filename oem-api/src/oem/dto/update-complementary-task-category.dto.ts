import { PartialType } from '@nestjs/swagger';
import { CreateComplementaryTaskCategoryDto } from './create-complementary-task-category.dto';

export class UpdateComplementaryTaskCategoryDto extends PartialType(
  CreateComplementaryTaskCategoryDto,
) {}
