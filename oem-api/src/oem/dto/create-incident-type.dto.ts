import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, IsInt, Min } from 'class-validator';
import { IncidentSeverity } from '../domain/incident-type.entity';

export class CreateIncidentTypeDto {
  @ApiProperty({ description: 'Unique code for the incident type', example: 'T-INC001' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^T-INC\d{3,}$/)
  code!: string;

  @ApiProperty({ description: 'Name of the incident type' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Description of this incident type' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: IncidentSeverity })
  @IsEnum(IncidentSeverity)
  severity!: IncidentSeverity;

  @ApiPropertyOptional({ description: 'Identifier of the parent incident type' })
  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === undefined || value === '' ? null : Number(value),
  )
  @IsInt()
  @Min(1)
  parentId?: number | null;
}
