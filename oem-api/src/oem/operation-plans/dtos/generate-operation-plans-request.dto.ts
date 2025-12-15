import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class GenerateOperationPlansRequestDto {
  @ApiProperty({ description: 'Target day for which plans should be generated (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiPropertyOptional({ description: 'Optional algorithm identifier', example: 'single-crane' })
  @IsString()
  @IsOptional()
  algorithm?: string;

  @ApiPropertyOptional({
    description:
      'Optional list of VVN identifiers to persist plans for. If omitted, all approved VVNs for the day are used.',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  vvnIds?: string[];
}
