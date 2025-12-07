import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDomainEntity } from './base-domain.entity';

/**
 * Categorisation reference for complementary tasks.
 */
export class ComplementaryTaskCategory extends BaseDomainEntity {
  @ApiProperty({ description: 'Category name' })
  name: string;

  @ApiPropertyOptional({ description: 'Category description' })
  description?: string;

  constructor(init?: Partial<ComplementaryTaskCategory>) {
    super(init);
    this.name = init?.name ?? '';
    this.description = init?.description;
  }
}
