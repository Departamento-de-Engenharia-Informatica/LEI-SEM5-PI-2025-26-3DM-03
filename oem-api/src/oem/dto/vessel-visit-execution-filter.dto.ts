import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class VesselVisitExecutionFilterDto {
  @ApiPropertyOptional({
    description: 'Data/hora inicial (inclusive) para chegada real',
    example: '2025-12-15T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Data/hora final (inclusive) para chegada real',
    example: '2025-12-16T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'ID da visita ao navio (VVN)', example: 123 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  vesselVisitId?: number;

  @ApiPropertyOptional({ description: 'Filtro por nome do navio (contém)', example: 'Ever' })
  @IsOptional()
  @IsString()
  vesselName?: string;

  @ApiPropertyOptional({
    description: 'Estado da execu\u00e7\u00e3o',
    example: 'in-progress',
  })
  @IsOptional()
  @IsString()
  status?: string;
}
