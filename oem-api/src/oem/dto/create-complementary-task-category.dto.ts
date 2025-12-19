import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateComplementaryTaskCategoryDto {
  @ApiProperty({ description: 'Unique code for the category', example: 'CTC001' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^CTC\d{3,}$/)
  code!: string;

  @ApiProperty({ description: 'Name of the category' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Category description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Default expected duration in minutes (e.g. 60 for 1h)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultDurationMinutes?: number;
}
