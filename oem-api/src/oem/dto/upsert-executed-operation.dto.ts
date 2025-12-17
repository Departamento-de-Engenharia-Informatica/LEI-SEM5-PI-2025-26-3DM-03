import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsObject, IsOptional } from 'class-validator';

export class UpsertExecutedOperationDto {
  @ApiPropertyOptional({ description: 'Actual execution start time in ISO-8601 format' })
  @IsISO8601()
  @IsOptional()
  actualStartTime?: string;

  @ApiPropertyOptional({ description: 'Actual execution end time in ISO-8601 format' })
  @IsISO8601()
  @IsOptional()
  actualEndTime?: string;

  @ApiPropertyOptional({ description: 'Resources used during execution', type: Object })
  @IsObject()
  @IsOptional()
  resourcesUsed?: Record<string, unknown>;
}
