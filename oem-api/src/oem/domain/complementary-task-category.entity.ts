import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDomainEntity } from './base-domain.entity';

/**
 * Categorisation reference for complementary tasks.
 */
export class ComplementaryTaskCategory extends BaseDomainEntity {
  @ApiProperty({ description: 'Stable category code' })
  code: string;

  @ApiProperty({ description: 'Category name' })
  name: string;

  @ApiPropertyOptional({ description: 'Category description', nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ description: 'Default duration in minutes', nullable: true })
  defaultDurationMinutes?: number | null;

  constructor(init?: Partial<ComplementaryTaskCategory>) {
    super(init);
    this.code = init?.code ?? '';
    this.name = init?.name ?? '';
    this.description = init?.description ?? null;
    this.defaultDurationMinutes = init?.defaultDurationMinutes ?? null;
  }
}
