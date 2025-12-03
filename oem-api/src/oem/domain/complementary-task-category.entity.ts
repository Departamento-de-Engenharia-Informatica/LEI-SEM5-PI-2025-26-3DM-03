import { BaseDomainEntity } from './base-domain.entity';

/**
 * Categorisation reference for complementary tasks.
 */
export class ComplementaryTaskCategory extends BaseDomainEntity {
  constructor(init?: Partial<ComplementaryTaskCategory>) {
    super(init);
  }
}
