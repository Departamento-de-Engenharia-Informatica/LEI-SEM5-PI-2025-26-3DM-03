import { BaseDomainEntity } from './base-domain.entity';

/**
 * Stub entity for an individual operation scheduled within an operation plan.
 */
export class PlannedOperation extends BaseDomainEntity {
  constructor(init?: Partial<PlannedOperation>) {
    super(init);
  }
}
