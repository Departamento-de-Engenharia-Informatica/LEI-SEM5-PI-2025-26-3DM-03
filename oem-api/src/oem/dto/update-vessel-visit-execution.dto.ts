import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateVesselVisitExecutionDto {
  @ApiPropertyOptional({ description: 'Actual berth time recorded once the vessel is docked' })
  @IsISO8601()
  @IsOptional()
  actualBerthTime?: string;

  @ApiPropertyOptional({ description: 'Identifier of the dock that received the vessel' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  dockId?: string;
}
