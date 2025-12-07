import { PartialType } from '@nestjs/swagger';
import { CreateVesselVisitExecutionDto } from './create-vessel-visit-execution.dto';

export class UpdateVesselVisitExecutionDto extends PartialType(CreateVesselVisitExecutionDto) {}
