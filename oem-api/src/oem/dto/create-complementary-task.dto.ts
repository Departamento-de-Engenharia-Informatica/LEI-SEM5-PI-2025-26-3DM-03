import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ComplementaryTaskStatus } from '../domain/complementary-task.entity';

export class CreateComplementaryTaskDto {
  @ApiProperty({ description: 'Task title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Task details' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Category identifier' })
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiPropertyOptional({ description: 'Related operation plan id' })
  @IsString()
  @IsOptional()
  operationPlanId?: string;

  @ApiPropertyOptional({ description: 'User responsible for the task' })
  @IsString()
  @IsOptional()
  assigneeId?: string;

  @ApiPropertyOptional({
    description: 'Due date (ISO-8601)',
    example: '2025-12-10',
  })
  @IsISO8601()
  @IsOptional()
  dueDate?: string;

  @ApiProperty({
    enum: ComplementaryTaskStatus,
    default: ComplementaryTaskStatus.Pending,
  })
  @IsEnum(ComplementaryTaskStatus)
  status: ComplementaryTaskStatus = ComplementaryTaskStatus.Pending;
}
