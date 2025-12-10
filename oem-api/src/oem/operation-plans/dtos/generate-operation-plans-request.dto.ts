import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class GenerateOperationPlansRequestDto {
  @ApiProperty({ description: 'Target day for which plans should be generated (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiPropertyOptional({ description: 'Optional algorithm identifier', example: 'fake-sequential' })
  @IsString()
  @IsOptional()
  algorithm?: string;
}
