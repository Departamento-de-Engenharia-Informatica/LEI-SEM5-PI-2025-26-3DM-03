import { PartialType } from '@nestjs/swagger';
import { CreateComplementaryTaskDto } from './create-complementary-task.dto';

export class UpdateComplementaryTaskDto extends PartialType(CreateComplementaryTaskDto) {}
