import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IncidentSeverity } from '../domain/incident-type.entity';
import { IncidentStatus } from '../domain/incident.entity';

export class CreateIncidentDto {
  @ApiProperty({ description: 'Type identifier', example: 'incident-type-1' })
  @IsString()
  @IsNotEmpty()
  typeId!: string;

  @ApiProperty({ description: 'Short title of the incident' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Detailed description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Linked operation plan id' })
  @IsString()
  @IsOptional()
  operationPlanId?: string;

  @ApiProperty({
    enum: IncidentStatus,
    default: IncidentStatus.Open,
  })
  @IsEnum(IncidentStatus)
  status: IncidentStatus = IncidentStatus.Open;

  @ApiProperty({
    enum: IncidentSeverity,
    default: IncidentSeverity.Low,
  })
  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity = IncidentSeverity.Low;

  @ApiProperty({
    description: 'Occurrence timestamp (ISO-8601)',
    example: '2025-12-07T10:00:00Z',
  })
  @IsISO8601()
  occurredAt!: string;

  @ApiPropertyOptional({
    description: 'Resolution timestamp (ISO-8601)',
  })
  @IsISO8601()
  @IsOptional()
  resolvedAt?: string;
}
