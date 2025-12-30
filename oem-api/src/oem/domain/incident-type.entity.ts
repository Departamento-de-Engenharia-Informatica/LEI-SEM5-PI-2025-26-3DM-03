import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDomainEntity } from './base-domain.entity';

export enum IncidentSeverity {
  MINOR = 'MINOR',
  MAJOR = 'MAJOR',
  CRITICAL = 'CRITICAL',
}

/**
 * Catalog entry describing a type/category of incident.
 */
export class IncidentType extends BaseDomainEntity {
  @ApiProperty({ description: 'Stable code used to reference the incident type' })
  code: string;

  @ApiProperty({ description: 'Name of the incident type' })
  name: string;

  @ApiPropertyOptional({ description: 'Description of this incident type' })
  description?: string;

  @ApiProperty({ enum: IncidentSeverity })
  severity: IncidentSeverity;

  @ApiPropertyOptional({ description: 'Identifier of the parent incident type', nullable: true })
  parentId?: number | null;

  @ApiPropertyOptional({ type: () => IncidentType, description: 'Parent incident type', nullable: true })
  parent?: IncidentType | null;

  @ApiPropertyOptional({
    type: () => [IncidentType],
    description: 'Immediate children incident types',
    nullable: true,
  })
  children?: IncidentType[];

  @ApiPropertyOptional({ description: 'Last update timestamp', nullable: true })
  updatedAt?: Date | null;

  constructor(init?: Partial<IncidentType>) {
    super(init);
    this.code = init?.code ?? '';
    this.name = init?.name ?? '';
    this.description = init?.description;
    this.severity = init?.severity ?? IncidentSeverity.MINOR;
    this.parentId = init?.parentId ?? null;
    this.parent = init?.parent ?? null;
    this.children = init?.children;
    this.updatedAt = init?.updatedAt ?? null;
  }
}
