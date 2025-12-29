import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { ComplementaryTaskMode } from '../domain/complementary-task.entity';

export class UpdateComplementaryTaskDto {
  @ApiPropertyOptional({ description: 'Category identifier', type: Number })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  categoryId?: number;

  @ApiPropertyOptional({ description: 'Responsible team or service' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  team?: string;

  @ApiPropertyOptional({ enum: ComplementaryTaskMode })
  @IsOptional()
  @IsEnum(ComplementaryTaskMode)
  mode?: ComplementaryTaskMode;

  @ApiPropertyOptional({ description: 'Task start time (ISO-8601)' })
  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @ApiPropertyOptional({ description: 'Task completion time (ISO-8601)' })
  @IsOptional()
  @IsISO8601()
  endTime?: string;
}
