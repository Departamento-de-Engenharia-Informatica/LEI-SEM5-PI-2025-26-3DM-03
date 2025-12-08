import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsISO8601, IsOptional, IsString } from 'class-validator';

export class GenerateOperationPlansDto {
  @ApiProperty({
    description: 'Target day for which plans must be generated (ISO date)',
    example: '2025-12-08',
  })
  @IsISO8601()
  targetDay!: string;

  @ApiProperty({
    description: 'Scheduling algorithm identifier',
    example: 'optimal',
  })
  @IsString()
  algorithm!: string;

  @ApiPropertyOptional({
    description: 'Whether to persist the generated plans immediately',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  save?: boolean = false;
}
