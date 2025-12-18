import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

export class CompleteVesselVisitExecutionDto {
  @ApiProperty({
    description: 'Actual unberth time (when the vessel leaves the dock)',
    example: '2025-12-01T18:30:00Z',
  })
  @IsISO8601()
  actualUnberthTime!: string;

  @ApiProperty({
    description: 'Actual port departure time (when the vessel exits port limits)',
    example: '2025-12-01T20:00:00Z',
  })
  @IsISO8601()
  actualPortDepartureTime!: string;
}
