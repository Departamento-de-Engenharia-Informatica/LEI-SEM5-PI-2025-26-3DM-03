import { BaseDomainEntity } from './base-domain.entity';

/**
 * Incident reported during execution, linked to a plan or operation.
 */
export class Incident extends BaseDomainEntity {
  constructor(init?: Partial<Incident>) {
    super(init);
  }
}
