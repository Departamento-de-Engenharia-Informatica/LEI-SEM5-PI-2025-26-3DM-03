import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IncidentSeverity } from '../domain/incident-type.entity';

export class CreateIncidentTypeDto {
  @ApiProperty({ description: 'Name of the incident type' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Description of this incident type' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: IncidentSeverity,
    default: IncidentSeverity.Low,
  })
  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity = IncidentSeverity.Low;
}
