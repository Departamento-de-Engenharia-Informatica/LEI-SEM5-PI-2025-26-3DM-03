import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class RegenerateMissingOperationPlansRequestDto {
  @ApiProperty({ description: 'Target day (YYYY-MM-DD)', example: '2025-12-16' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiPropertyOptional({ description: 'Algorithm identifier', example: 'single-crane', default: 'single-crane' })
  @IsString()
  @IsOptional()
  algorithm?: string;

  @ApiProperty({
    description:
      'Confirmation flag required to overwrite any existing plans for the target day. Set true to proceed.',
    default: false,
  })
  @IsBoolean()
  confirmOverwrite!: boolean;
}
