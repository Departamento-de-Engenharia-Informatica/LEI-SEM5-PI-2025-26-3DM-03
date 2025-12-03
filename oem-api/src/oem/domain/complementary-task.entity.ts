import { BaseDomainEntity } from './base-domain.entity';

/**
 * Represents an auxiliary task associated with an operation execution.
 */
export class ComplementaryTask extends BaseDomainEntity {
  constructor(init?: Partial<ComplementaryTask>) {
    super(init);
  }
}
