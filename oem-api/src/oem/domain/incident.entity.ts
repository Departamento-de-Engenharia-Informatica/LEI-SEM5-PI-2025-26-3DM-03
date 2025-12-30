import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDomainEntity } from './base-domain.entity';
import { IncidentSeverity } from './incident-type.entity';

export enum IncidentStatus {
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
}

export enum IncidentScope {
  ALL_ONGOING = 'ALL_ONGOING',
  SPECIFIC = 'SPECIFIC',
  UPCOMING = 'UPCOMING',
}

/**
 * Incident raised within the OEM context, potentially impacting vessel visit executions.
 */
export class Incident extends BaseDomainEntity {
  @ApiProperty({ description: 'Stable unique incident identifier (e.g. INC-2025-0001)' })
  identifier: string;

  @ApiProperty({ description: 'Associated incident type identifier' })
  incidentTypeId: number;

  @ApiPropertyOptional({ description: 'Friendly incident type metadata', nullable: true })
  incidentType?: { id: number; code: string; name: string } | null;

  @ApiProperty({ enum: IncidentSeverity })
  severity: IncidentSeverity;

  @ApiPropertyOptional({ description: 'Free-text description', nullable: true })
  description?: string | null;

  @ApiProperty({ description: 'Timestamp when the incident started' })
  startTime: Date;

  @ApiPropertyOptional({ description: 'Timestamp when the incident ended', nullable: true })
  endTime?: Date | null;

  @ApiPropertyOptional({ description: 'Total duration in minutes once resolved', nullable: true })
  durationMinutes?: number | null;

  @ApiProperty({ enum: IncidentScope })
  scope: IncidentScope;

  @ApiPropertyOptional({ description: 'Impact window start (UPCOMING scope)', nullable: true })
  impactFrom?: Date | null;

  @ApiPropertyOptional({ description: 'Impact window end (UPCOMING scope)', nullable: true })
  impactTo?: Date | null;

  @ApiProperty({ description: 'User who created the incident' })
  createdBy: string;

  @ApiPropertyOptional({ description: 'Last update timestamp', nullable: true })
  updatedAt?: Date | null;

  @ApiProperty({ enum: IncidentStatus })
  status: IncidentStatus;

  @ApiPropertyOptional({
    description: 'Whether the incident is impacting operations right now',
    nullable: true,
  })
  isImpactingNow?: boolean;

  @ApiPropertyOptional({
    description: 'Associated vessel visit execution identifiers',
    type: [Number],
    nullable: true,
  })
  affectedVveIds?: number[] | null;

  constructor(init?: Partial<Incident>) {
    super(init);
    this.identifier = init?.identifier ?? '';
    this.incidentTypeId = init?.incidentTypeId ?? 0;
    this.incidentType = init?.incidentType ?? null;
    this.severity = init?.severity ?? IncidentSeverity.MINOR;
    this.description = init?.description ?? null;
    this.startTime = init?.startTime ?? new Date();
    this.endTime = init?.endTime ?? null;
    this.durationMinutes = init?.durationMinutes ?? null;
    this.scope = init?.scope ?? IncidentScope.ALL_ONGOING;
    this.impactFrom = init?.impactFrom ?? null;
    this.impactTo = init?.impactTo ?? null;
    this.createdBy = init?.createdBy ?? 'system';
    this.updatedAt = init?.updatedAt ?? null;
    this.status = init?.status ?? IncidentStatus.ACTIVE;
    this.isImpactingNow = init?.isImpactingNow ?? false;
    this.affectedVveIds = init?.affectedVveIds ?? null;
  }
}
