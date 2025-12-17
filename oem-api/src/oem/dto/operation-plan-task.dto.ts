import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class OperationPlanTaskDto {
  @ApiPropertyOptional({ description: 'Task identifier (used when editing existing tasks)' })
  @Type(() => Number)
  @IsOptional()
  id?: number;

  @ApiPropertyOptional({ description: 'Logical type of the task', example: 'UNLOAD' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiPropertyOptional({ description: 'Assigned crane identifier' })
  @IsString()
  @IsOptional()
  craneId?: string;

  @ApiPropertyOptional({ description: 'Storage area associated to the task' })
  @IsString()
  @IsOptional()
  storageAreaId?: string;

  @ApiPropertyOptional({ description: 'Assigned staff identifiers', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  staffIds?: string[];

  @ApiPropertyOptional({ description: 'Planned start time in ISO-8601' })
  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @ApiPropertyOptional({ description: 'Planned end time in ISO-8601' })
  @IsDateString()
  @IsNotEmpty()
  endTime!: string;

  @ApiPropertyOptional({
    description: 'Optional free-text note on why this task is being changed',
    maxLength: 240,
  })
  @IsString()
  @IsOptional()
  @MaxLength(240)
  note?: string;
}
