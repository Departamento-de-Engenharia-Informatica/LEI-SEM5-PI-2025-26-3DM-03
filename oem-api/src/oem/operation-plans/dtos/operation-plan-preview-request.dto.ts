import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class OperationPlanPreviewRequestDto {
  @ApiProperty({ description: 'Target day to generate previews (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiPropertyOptional({ description: 'Optional algorithm identifier' })
  @IsString()
  @IsOptional()
  algorithm?: string;

  @ApiPropertyOptional({
    description:
      'Optional list of VVN identifiers to include. If omitted, all approved VVNs for the day are considered.',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  vvnIds?: string[];
}
