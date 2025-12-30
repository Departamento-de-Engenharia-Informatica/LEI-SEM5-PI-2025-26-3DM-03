import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { IncidentSeverity } from '../domain/incident-type.entity';

export class IncidentTypeQueryDto {
  @ApiPropertyOptional({ description: 'Filter by parent incident type identifier' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parentId?: number;

  @ApiPropertyOptional({ enum: IncidentSeverity, description: 'Filter by severity level' })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @ApiPropertyOptional({ description: 'Free text search across code and name' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Return hierarchical tree instead of flat list', type: Boolean })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  tree?: boolean;
}
