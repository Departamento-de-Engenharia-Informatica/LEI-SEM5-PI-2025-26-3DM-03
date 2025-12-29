import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ComplementaryTaskMode } from '../domain/complementary-task.entity';

export class CreateComplementaryTaskDto {
  @ApiProperty({ description: 'Category identifier', type: Number })
  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  categoryId!: number;

  @ApiProperty({ description: 'Vessel visit execution identifier', type: Number })
  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  vveId!: number;

  @ApiProperty({ description: 'Responsible team or service' })
  @IsString()
  @MaxLength(256)
  @IsNotEmpty()
  team!: string;

  @ApiProperty({ enum: ComplementaryTaskMode })
  @IsEnum(ComplementaryTaskMode)
  mode!: ComplementaryTaskMode;

  @ApiProperty({ description: 'Task start time (ISO-8601)' })
  @IsISO8601()
  @IsNotEmpty()
  startTime!: string;

  @ApiPropertyOptional({ description: 'Task completion time (ISO-8601)' })
  @IsISO8601()
  @IsOptional()
  endTime?: string;
}
