import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IncidentSeverity } from '../domain/incident-type.entity';
import { IncidentScope } from '../domain/incident.entity';

export class CreateIncidentDto {
  @ApiProperty({ description: 'Incident type identifier', example: 1 })
  @IsInt()
  @Type(() => Number)
  incidentTypeId!: number;

  @ApiProperty({ enum: IncidentSeverity, description: 'Severity level for the incident' })
  @IsEnum(IncidentSeverity)
  severity!: IncidentSeverity;

  @ApiProperty({ description: 'ISO-8601 timestamp when the incident started' })
  @IsISO8601()
  startTime!: string;

  @ApiPropertyOptional({ description: 'ISO-8601 timestamp when the incident ended (if resolved)' })
  @IsOptional()
  @IsISO8601()
  endTime?: string | null;

  @ApiPropertyOptional({ description: 'Free-text description of the incident' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({ enum: IncidentScope, description: 'Impact scope' })
  @IsEnum(IncidentScope)
  scope!: IncidentScope;

  @ApiPropertyOptional({ description: 'Impact window start (ISO-8601) for UPCOMING incidents' })
  @IsOptional()
  @IsISO8601()
  impactFrom?: string | null;

  @ApiPropertyOptional({ description: 'Impact window end (ISO-8601) for UPCOMING incidents' })
  @IsOptional()
  @IsISO8601()
  impactTo?: string | null;

  @ApiPropertyOptional({
    description: 'Identifiers of impacted VVEs (required for SPECIFIC scope)',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  affectedVveIds?: number[];
}
