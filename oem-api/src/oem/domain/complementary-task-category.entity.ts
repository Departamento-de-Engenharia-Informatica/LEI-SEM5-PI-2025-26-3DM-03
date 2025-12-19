import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDomainEntity } from './base-domain.entity';

/**
 * Categorisation reference for complementary tasks.
 */
export class ComplementaryTaskCategory extends BaseDomainEntity {
  @ApiProperty({ description: 'Category name' })
    private readonly code: string;
    name: string;

  @ApiPropertyOptional({ description: 'Category description' })
    private readonly description?: string | null;
    private readonly defaultDurationMinutes?: number | null;

    constructor(
      init?: Partial<ComplementaryTaskCategory>,
      code: string,
      defaultDurationMinutes?: number | null,
    ) {
      super(init);
      this.code = code;
      this.name = init?.name ?? '';
      this.description = init?.description ?? null;
      this.defaultDurationMinutes =
        defaultDurationMinutes !== undefined ? defaultDurationMinutes : null;
  }
}
