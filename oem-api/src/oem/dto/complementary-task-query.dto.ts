import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { ComplementaryTaskStatus } from '../domain/complementary-task.entity';

export class ComplementaryTaskQueryDto {
  @ApiPropertyOptional({ description: 'Filter by vessel visit execution id', type: Number })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  vveId?: number;

  @ApiPropertyOptional({ description: 'Filter by vessel identifier' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  vesselIdentifier?: string;

  @ApiPropertyOptional({ enum: ComplementaryTaskStatus, description: 'Filter by derived status' })
  @IsOptional()
  @IsEnum(ComplementaryTaskStatus)
  status?: ComplementaryTaskStatus;

  @ApiPropertyOptional({ description: 'Filter tasks overlapping from this time (ISO-8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter tasks overlapping until this time (ISO-8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
