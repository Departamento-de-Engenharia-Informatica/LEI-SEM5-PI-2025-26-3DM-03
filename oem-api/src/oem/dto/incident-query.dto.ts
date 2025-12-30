import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IncidentScope, IncidentStatus } from '../domain/incident.entity';
import { IncidentSeverity } from '../domain/incident-type.entity';

export class IncidentQueryDto {
  @ApiPropertyOptional({ description: 'Filter by vessel identifier impacted by the incident' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  vesselIdentifier?: string;

  @ApiPropertyOptional({ description: 'Start of the time range (ISO-8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'End of the time range (ISO-8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ enum: IncidentSeverity, description: 'Filter by severity' })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @ApiPropertyOptional({ enum: IncidentStatus, description: 'Filter by incident status' })
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @ApiPropertyOptional({ description: 'Filter by incident type identifier', type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  incidentTypeId?: number;

  @ApiPropertyOptional({ enum: IncidentScope, description: 'Filter by impact scope' })
  @IsOptional()
  @IsEnum(IncidentScope)
  scope?: IncidentScope;
}
