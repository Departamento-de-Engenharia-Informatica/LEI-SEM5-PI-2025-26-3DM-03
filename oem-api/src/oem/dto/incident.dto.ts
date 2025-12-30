import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentScope, IncidentStatus } from '../domain/incident.entity';
import { IncidentSeverity } from '../domain/incident-type.entity';

export class IncidentTypeSummaryDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

export class IncidentDto {
  @ApiProperty({ description: 'Numeric identifier' })
  id!: number;

  @ApiProperty({ description: 'Stable identifier string, e.g. INC-2025-0001' })
  identifier!: string;

  @ApiProperty({ description: 'Incident type identifier' })
  incidentTypeId!: number;

  @ApiPropertyOptional({ description: 'Incident type metadata', type: IncidentTypeSummaryDto, nullable: true })
  incidentType?: IncidentTypeSummaryDto | null;

  @ApiProperty({ enum: IncidentSeverity })
  severity!: IncidentSeverity;

  @ApiPropertyOptional({ description: 'Free-text description', nullable: true })
  description?: string | null;

  @ApiProperty({ description: 'Start timestamp' })
  startTime!: Date;

  @ApiPropertyOptional({ description: 'End timestamp', nullable: true })
  endTime?: Date | null;

  @ApiPropertyOptional({ description: 'Duration in minutes', nullable: true })
  durationMinutes?: number | null;

  @ApiProperty({ enum: IncidentScope })
  scope!: IncidentScope;

  @ApiPropertyOptional({ description: 'Impact window start', nullable: true })
  impactFrom?: Date | null;

  @ApiPropertyOptional({ description: 'Impact window end', nullable: true })
  impactTo?: Date | null;

  @ApiProperty({ description: 'Creator identifier' })
  createdBy!: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;

  @ApiProperty({ enum: IncidentStatus })
  status!: IncidentStatus;

  @ApiPropertyOptional({ description: 'Whether the incident is currently impacting operations', nullable: true })
  isImpactingNow?: boolean;

  @ApiPropertyOptional({ description: 'Identifiers of impacted VVEs (SPECIFIC scope)', type: [Number], nullable: true })
  affectedVveIds?: number[] | null;
}
