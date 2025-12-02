import { BaseDomainEntity } from './base-domain.entity';

/**
 * Represents the high-level operations blueprint for a vessel visit or shift.
 * Fields beyond id/createdAt will be introduced alongside persistence modelling.
 */
export class OperationPlan extends BaseDomainEntity {
  constructor(init?: Partial<OperationPlan>) {
    super(init);
  }
}
