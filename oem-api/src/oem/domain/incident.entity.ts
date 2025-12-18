import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDomainEntity } from './base-domain.entity';
import { IncidentSeverity } from './incident-type.entity';

export enum IncidentStatus {
  Open = 'open',
  Investigating = 'investigating',
  Resolved = 'resolved',
  Closed = 'closed',
}

/**
 * Incident reported during execution, linked to a plan or operation.
 */
export class Incident extends BaseDomainEntity {
  @ApiProperty({ description: 'Incident type identifier' })
  typeId: number;

  @ApiProperty({ description: 'Incident title' })
  title: string;

  @ApiPropertyOptional({ description: 'Detailed description' })
  description?: string;

  @ApiProperty({ enum: IncidentStatus })
  status: IncidentStatus;

  @ApiProperty({ enum: IncidentSeverity })
  severity: IncidentSeverity;

  @ApiProperty({ description: 'When the incident occurred' })
  occurredAt: Date;

  @ApiPropertyOptional({ description: 'When the incident was resolved' })
  resolvedAt?: Date;

  @ApiPropertyOptional({
    description: 'Linked operation plan',
  })
  operationPlanId?: number;

  constructor(init?: Partial<Incident>) {
    super(init);
    this.typeId = init?.typeId ?? 0;
    this.title = init?.title ?? '';
    this.description = init?.description;
    this.status = init?.status ?? IncidentStatus.Open;
    this.severity = init?.severity ?? IncidentSeverity.MINOR;
    this.occurredAt = init?.occurredAt ?? new Date();
    this.resolvedAt = init?.resolvedAt;
    this.operationPlanId = init?.operationPlanId;
  }
}
