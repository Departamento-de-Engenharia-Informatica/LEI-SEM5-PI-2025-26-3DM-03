import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDomainEntity } from './base-domain.entity';

export enum ComplementaryTaskMode {
  PARALLEL = 'PARALLEL',
  SUSPENDS = 'SUSPENDS',
}

export enum ComplementaryTaskStatus {
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
}

/**
 * Represents a non-cargo task executed during a vessel visit.
 */
export class ComplementaryTask extends BaseDomainEntity {
  @ApiProperty({ description: 'Business identifier (e.g. CT-2025-0001)' })
  identifier: string;

  @ApiProperty({ description: 'Complementary task category id' })
  categoryId: number;

  @ApiProperty({ description: 'Vessel visit execution id' })
  vveId: number;

  @ApiProperty({ description: 'Responsible team or service' })
  team: string;

  @ApiProperty({ enum: ComplementaryTaskMode, description: 'Execution mode' })
  mode: ComplementaryTaskMode;

  @ApiProperty({ description: 'Task start time' })
  startTime: Date;

  @ApiPropertyOptional({ description: 'Task completion time' })
  endTime?: Date | null;

  @ApiPropertyOptional({ description: 'Duration in minutes once completed' })
  durationMinutes?: number | null;

  @ApiProperty({ enum: ComplementaryTaskStatus, description: 'Derived status' })
  status: ComplementaryTaskStatus;

  @ApiProperty({ description: 'Indicates if task currently impacts operations' })
  isImpactingNow: boolean;

  @ApiProperty({ description: 'User responsible for creation' })
  createdBy: string;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  constructor(init?: Partial<ComplementaryTask>) {
    super(init);
    this.identifier = init?.identifier ?? '';
    this.categoryId = init?.categoryId ?? 0;
    this.vveId = init?.vveId ?? 0;
    this.team = init?.team ?? '';
    this.mode = init?.mode ?? ComplementaryTaskMode.PARALLEL;
    this.startTime = init?.startTime ?? new Date();
    this.endTime = init?.endTime ?? null;
    this.durationMinutes = init?.durationMinutes ?? null;
    this.status = init?.status ?? ComplementaryTaskStatus.ONGOING;
    this.isImpactingNow = init?.isImpactingNow ?? false;
    this.createdBy = init?.createdBy ?? 'system';
    this.updatedAt = init?.updatedAt ?? new Date();
  }
}
