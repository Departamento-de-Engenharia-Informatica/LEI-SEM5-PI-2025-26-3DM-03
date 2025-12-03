import { BaseDomainEntity } from './base-domain.entity';

/**
 * Catalog entry describing a type/category of incident.
 */
export class IncidentType extends BaseDomainEntity {
  constructor(init?: Partial<IncidentType>) {
    super(init);
  }
}
