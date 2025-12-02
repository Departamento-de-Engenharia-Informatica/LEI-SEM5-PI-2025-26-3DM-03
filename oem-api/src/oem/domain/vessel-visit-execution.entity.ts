import { BaseDomainEntity } from './base-domain.entity';

/**
 * Placeholder aggregate capturing the execution record of a vessel visit.
 */
export class VesselVisitExecution extends BaseDomainEntity {
  constructor(init?: Partial<VesselVisitExecution>) {
    super(init);
  }
}
