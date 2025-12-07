import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDomainEntity } from './base-domain.entity';

export enum OperationPlanStatus {
  Draft = 'draft',
  Planned = 'planned',
  InProgress = 'in-progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

/**
 * Represents the high-level operations blueprint for a vessel visit or shift.
 */
export class OperationPlan extends BaseDomainEntity {
  @ApiProperty({ description: 'Name of the operation plan' })
  name: string;

  @ApiPropertyOptional({ description: 'Detailed description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Identifier of the related vessel visit' })
  vesselVisitId?: string;

  @ApiPropertyOptional({
    description: 'Shift date for the plan',
    type: String,
    format: 'date',
  })
  shiftDate?: Date;

  @ApiProperty({ enum: OperationPlanStatus })
  status: OperationPlanStatus;

  constructor(init?: Partial<OperationPlan>) {
    super(init);
    this.name = init?.name ?? '';
    this.description = init?.description;
    this.vesselVisitId = init?.vesselVisitId;
    this.shiftDate = init?.shiftDate;
    this.status = init?.status ?? OperationPlanStatus.Draft;
  }
}
