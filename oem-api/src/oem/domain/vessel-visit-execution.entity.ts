import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDomainEntity } from './base-domain.entity';

export enum VesselExecutionStatus {
  Pending = 'pending',
  InProgress = 'in-progress',
  Active = 'active',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

/**
 * Captures execution details of a vessel visit linked to an operation plan.
 */
export class VesselVisitExecution extends BaseDomainEntity {
  @ApiProperty({ description: 'Unique identifier for this execution' })
  identifier: string;

  @ApiProperty({ description: 'Reference to the source Vessel Visit Notification' })
  vvnId: string;

  @ApiProperty({ description: 'Vessel identifier copied from the VVN (e.g. vesselId or IMO)' })
  vesselIdentifier: string;

  @ApiPropertyOptional({ description: 'Voyage number or reference' })
  voyageNumber?: string;

  @ApiPropertyOptional({ description: 'Linked operation plan id' })
  operationPlanId?: number;

  @ApiProperty({ description: 'Actual arrival time recorded when the vessel reached the port' })
  actualArrivalTime: Date;

  @ApiPropertyOptional({ description: 'Estimated time of arrival' })
  eta?: Date;

  @ApiPropertyOptional({ description: 'Estimated time of departure' })
  etd?: Date;

  @ApiProperty({ description: 'User identifier who created the execution record' })
  createdBy: string;

  @ApiProperty({ enum: VesselExecutionStatus })
  status: VesselExecutionStatus;

  constructor(init?: Partial<VesselVisitExecution>) {
    super(init);
    this.identifier = init?.identifier ?? '';
    this.vvnId = init?.vvnId ?? '';
    this.vesselIdentifier = init?.vesselIdentifier ?? '';
    this.voyageNumber = init?.voyageNumber;
    this.operationPlanId = init?.operationPlanId;
    this.actualArrivalTime = init?.actualArrivalTime ?? new Date();
    this.eta = init?.eta;
    this.etd = init?.etd;
    this.createdBy = init?.createdBy ?? 'system';
    this.status = init?.status ?? VesselExecutionStatus.InProgress;
  }
}
