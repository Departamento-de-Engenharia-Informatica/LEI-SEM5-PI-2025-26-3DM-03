/**
 * Base placeholder for OEM aggregates/entities.
 * Additional attributes (tenant, metadata, etc.) can be added in future iterations.
 */
export abstract class BaseDomainEntity {
  /** Unique identifier coming from persistence (UUID expected). */
  id: string;

  /** Creation timestamp in UTC. */
  createdAt: Date;

  protected constructor(init?: Partial<BaseDomainEntity>) {
    this.id = init?.id ?? '';
    this.createdAt = init?.createdAt ?? new Date();
  }
}
