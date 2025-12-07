import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { VesselExecutionStatus } from '../domain/vessel-visit-execution.entity';

export class CreateVesselVisitExecutionDto {
  @ApiProperty({ description: 'Vessel name' })
  @IsString()
  @IsNotEmpty()
  vesselName: string;

  @ApiPropertyOptional({ description: 'Voyage number or reference' })
  @IsString()
  @IsOptional()
  voyageNumber?: string;

  @ApiPropertyOptional({ description: 'Related operation plan id' })
  @IsString()
  @IsOptional()
  operationPlanId?: string;

  @ApiPropertyOptional({ description: 'Estimated time of arrival (ISO-8601)' })
  @IsISO8601()
  @IsOptional()
  eta?: string;

  @ApiPropertyOptional({ description: 'Estimated time of departure (ISO-8601)' })
  @IsISO8601()
  @IsOptional()
  etd?: string;

  @ApiProperty({
    enum: VesselExecutionStatus,
    default: VesselExecutionStatus.Pending,
  })
  @IsEnum(VesselExecutionStatus)
  status: VesselExecutionStatus = VesselExecutionStatus.Pending;
}
