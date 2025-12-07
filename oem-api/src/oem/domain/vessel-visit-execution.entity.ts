import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDomainEntity } from './base-domain.entity';

export enum VesselExecutionStatus {
  Pending = 'pending',
  Active = 'active',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

/**
 * Captures execution details of a vessel visit linked to an operation plan.
 */
export class VesselVisitExecution extends BaseDomainEntity {
  @ApiProperty({ description: 'Vessel name' })
  vesselName: string;

  @ApiPropertyOptional({ description: 'Voyage number or reference' })
  voyageNumber?: string;

  @ApiPropertyOptional({ description: 'Linked operation plan id' })
  operationPlanId?: string;

  @ApiPropertyOptional({ description: 'Estimated time of arrival' })
  eta?: Date;

  @ApiPropertyOptional({ description: 'Estimated time of departure' })
  etd?: Date;

  @ApiProperty({ enum: VesselExecutionStatus })
  status: VesselExecutionStatus;

  constructor(init?: Partial<VesselVisitExecution>) {
    super(init);
    this.vesselName = init?.vesselName ?? '';
    this.voyageNumber = init?.voyageNumber;
    this.operationPlanId = init?.operationPlanId;
    this.eta = init?.eta;
    this.etd = init?.etd;
    this.status = init?.status ?? VesselExecutionStatus.Pending;
  }
}
