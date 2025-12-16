import { ApiProperty } from '@nestjs/swagger';

/**
 * Base placeholder for OEM aggregates/entities.
 * Additional attributes (tenant, metadata, etc.) can be added in future iterations.
 */
export abstract class BaseDomainEntity {
  /** Unique identifier coming from persistence (numeric autoincrement). */
  @ApiProperty({ description: 'Unique identifier (numeric)' })
  id: number;

  /** Creation timestamp in UTC. */
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  protected constructor(init?: Partial<BaseDomainEntity>) {
    this.id = init?.id ?? 0;
    this.createdAt = init?.createdAt ?? new Date();
  }
}
