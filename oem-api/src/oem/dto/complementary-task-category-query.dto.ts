import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ComplementaryTaskCategoryQueryDto {
  @ApiPropertyOptional({ description: 'Free text search across code, name and description' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  q?: string;
}
