import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDomainEntity } from './base-domain.entity';

export type PlanOperation = {
  resourceId?: string;
  resourceType?: string;
  operationType?: 'load' | 'unload' | 'move' | 'other';
  startTime?: Date;
  endTime?: Date;
};

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
  vesselVisitId?: number;

  @ApiPropertyOptional({
    description: 'VVN identifier that originated this plan',
  })
  sourceVvnId?: number;

  @ApiPropertyOptional({
    description: 'Shift date for the plan',
    type: String,
    format: 'date',
  })
  shiftDate?: Date;

  @ApiProperty({ enum: OperationPlanStatus })
  status: OperationPlanStatus;

  @ApiPropertyOptional({
    description: 'Day targeted for the plan generation',
    type: String,
    format: 'date',
  })
  targetDay?: Date;

  @ApiPropertyOptional({ description: 'Scheduling algorithm used' })
  algorithmUsed?: string;

  @ApiPropertyOptional({ description: 'User who created the plan' })
  createdBy?: string;

  @ApiPropertyOptional({
    description: 'List of operations composing the plan',
    type: Array,
  })
  operations?: PlanOperation[];

  constructor(init?: Partial<OperationPlan>) {
    super(init);
    this.name = init?.name ?? '';
    this.description = init?.description;
    this.vesselVisitId = init?.vesselVisitId;
    this.sourceVvnId = init?.sourceVvnId;
    this.shiftDate = init?.shiftDate;
    this.status = init?.status ?? OperationPlanStatus.Draft;
    this.targetDay = init?.targetDay;
    this.algorithmUsed = init?.algorithmUsed;
    this.createdBy = init?.createdBy;
    this.operations = init?.operations;
  }
}
