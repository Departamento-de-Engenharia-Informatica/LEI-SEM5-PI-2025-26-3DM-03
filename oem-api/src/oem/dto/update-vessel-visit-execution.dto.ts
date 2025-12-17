import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { CreateVesselVisitExecutionDto } from './create-vessel-visit-execution.dto';
import { VesselExecutionStatus } from '../domain/vessel-visit-execution.entity';

export class UpdateVesselVisitExecutionDto extends PartialType(CreateVesselVisitExecutionDto) {
	@IsString()
	@IsOptional()
	vesselIdentifier?: string;

	@IsISO8601()
	@IsOptional()
	actualArrivalTime?: string;

	@IsEnum(VesselExecutionStatus)
	@IsOptional()
	status?: VesselExecutionStatus;
}
