import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOperationPlanDto } from './create-operation-plan.dto';
import { OperationPlanTaskDto } from './operation-plan-task.dto';

export class UpdateOperationPlanDto extends PartialType(CreateOperationPlanDto) {
  @ApiProperty({
    description: 'Reason for the change that will be stored in the audit log',
    example: 'Reassign crane due to maintenance',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiProperty({
    description: 'Tasks that compose the plan (replaces existing tasks)',
    type: OperationPlanTaskDto,
    isArray: true,
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OperationPlanTaskDto)
  @IsOptional()
  tasks?: OperationPlanTaskDto[];
}
