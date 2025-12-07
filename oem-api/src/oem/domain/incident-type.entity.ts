import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDomainEntity } from './base-domain.entity';

export enum IncidentSeverity {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

/**
 * Catalog entry describing a type/category of incident.
 */
export class IncidentType extends BaseDomainEntity {
  @ApiProperty({ description: 'Name of the incident type' })
  name: string;

  @ApiPropertyOptional({ description: 'Description of this incident type' })
  description?: string;

  @ApiProperty({ enum: IncidentSeverity })
  severity: IncidentSeverity;

  constructor(init?: Partial<IncidentType>) {
    super(init);
    this.name = init?.name ?? '';
    this.description = init?.description;
    this.severity = init?.severity ?? IncidentSeverity.Low;
  }
}
