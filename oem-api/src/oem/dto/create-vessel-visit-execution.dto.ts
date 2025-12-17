import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsISO8601, IsNotEmpty, IsString } from 'class-validator';

export class CreateVesselVisitExecutionDto {
  @ApiProperty({ description: 'Identifier of the source Vessel Visit Notification' })
  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  vvnId!: string;

  @ApiProperty({ description: 'Actual arrival time registered for the vessel', example: '2025-12-01T08:30:00Z' })
  @IsISO8601()
  actualArrivalTime!: string;
}
