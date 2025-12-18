import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VesselExecutionStatus } from '../domain';

/**
 * Minimal representation for listing VVEs with derived metrics.
 * All durations are expressed in minutes.
 */
export class VesselVisitExecutionListItemDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  vesselVisitId!: number;

  @ApiProperty()
  vesselName!: string;

  @ApiPropertyOptional()
  berthId?: string | null;

  @ApiProperty({ enum: VesselExecutionStatus })
  status!: VesselExecutionStatus | string;

  @ApiPropertyOptional({ description: 'Planned arrival time (ISO8601)' })
  plannedArrivalTime?: string | null;

  @ApiPropertyOptional({ description: 'Actual arrival time (ISO8601)' })
  actualArrivalTime?: string | null;

  @ApiPropertyOptional({ description: 'Planned berth time (ISO8601)' })
  plannedBerthTime?: string | null;

  @ApiPropertyOptional({ description: 'Actual berth time (ISO8601)' })
  actualBerthTime?: string | null;

  @ApiPropertyOptional({ description: 'Planned departure time (ISO8601)' })
  plannedDepartureTime?: string | null;

  @ApiPropertyOptional({ description: 'Actual departure time (ISO8601)' })
  actualDepartureTime?: string | null;

  @ApiPropertyOptional({ description: 'Tempo total entre chegada real e partida real (minutos)' })
  totalTurnaroundMinutes?: number | null;

  @ApiPropertyOptional({ description: 'Tempo atracado (entre berth e partida, minutos)' })
  berthOccupancyMinutes?: number | null;

  @ApiPropertyOptional({ description: 'Tempo de espera at\u00e9 atracar (minutos)' })
  waitingForBerthMinutes?: number | null;

  @ApiPropertyOptional({ description: 'Atraso/adiantamento de chegada (minutos, pode ser negativo)' })
  arrivalDelayMinutes?: number | null;

  @ApiPropertyOptional({ description: 'Atraso/adiantamento de partida (minutos, pode ser negativo)' })
  departureDelayMinutes?: number | null;

  @ApiPropertyOptional({
    description:
      'Atrasos nas opera\u00e7\u00f5es (placeholder, depende de modelos futuros). Null quando n\u00e3o dispon\u00edvel.',
  })
  operationsDelayMinutes?: number | null;
}
