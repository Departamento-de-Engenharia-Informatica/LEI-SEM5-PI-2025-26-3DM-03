import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDomainEntity } from './base-domain.entity';

export enum VesselExecutionStatus {
  Scheduled = 'scheduled',
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

  @ApiPropertyOptional({ description: 'Numeric vessel visit identifier' })
  vesselVisitId?: number;

  @ApiProperty({ description: 'Vessel name (denormalized for quick display)' })
  vesselName: string;

  @ApiPropertyOptional({ description: 'Voyage number or reference' })
  voyageNumber?: string;

  @ApiPropertyOptional({ description: 'Linked operation plan id' })
  operationPlanId?: number;

  @ApiPropertyOptional({ description: 'Berth/dock identifier' })
  berthId?: string | null;

  @ApiPropertyOptional({ description: 'Planned arrival time (ETA)' })
  plannedArrivalTime?: Date | null;

  @ApiPropertyOptional({ description: 'Planned berth time (pilotage complete)' })
  plannedBerthTime?: Date | null;

  @ApiPropertyOptional({ description: 'Planned departure time (ETD)' })
  plannedDepartureTime?: Date | null;

  @ApiProperty({ description: 'Actual arrival time recorded when the vessel reached the port' })
  actualArrivalTime: Date;

  @ApiPropertyOptional({ description: 'Actual time the vessel berthed' })
  actualBerthTime?: Date | null;

  @ApiPropertyOptional({ description: 'Actual departure time when the vessel left the berth' })
  actualDepartureTime?: Date | null;

  @ApiPropertyOptional({ description: 'Estimated time of arrival' })
  eta?: Date;

  @ApiPropertyOptional({ description: 'Estimated time of departure' })
  etd?: Date;

  @ApiProperty({ description: 'User identifier who created the execution record' })
  createdBy: string;

  @ApiProperty({ enum: VesselExecutionStatus })
  status: VesselExecutionStatus;

  @ApiPropertyOptional({ description: 'Last operational warning related to the execution' })
  lastWarning?: string | null;

  @ApiPropertyOptional({ description: 'Last update timestamp' })
  updatedAt?: Date | null;

  constructor(init?: Partial<VesselVisitExecution>) {
    super(init);
    this.identifier = init?.identifier ?? '';
    this.vvnId = init?.vvnId ?? '';
    this.vesselVisitId = init?.vesselVisitId;
    this.vesselName = init?.vesselName ?? '';
    this.voyageNumber = init?.voyageNumber;
    this.operationPlanId = init?.operationPlanId;
    this.berthId = init?.berthId ?? null;
    this.plannedArrivalTime = init?.plannedArrivalTime ?? null;
    this.plannedBerthTime = init?.plannedBerthTime ?? null;
    this.plannedDepartureTime = init?.plannedDepartureTime ?? null;
    this.actualArrivalTime = init?.actualArrivalTime ?? new Date();
    this.actualBerthTime = init?.actualBerthTime ?? null;
    this.actualDepartureTime = init?.actualDepartureTime ?? null;
    this.eta = init?.eta;
    this.etd = init?.etd;
    this.createdBy = init?.createdBy ?? 'system';
    this.status = init?.status ?? VesselExecutionStatus.InProgress;
    this.lastWarning = init?.lastWarning ?? null;
    this.updatedAt = init?.updatedAt ?? null;
  }
}
