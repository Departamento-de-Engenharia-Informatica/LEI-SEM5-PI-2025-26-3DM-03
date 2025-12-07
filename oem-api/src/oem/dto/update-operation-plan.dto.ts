import { PartialType } from '@nestjs/swagger';
import { CreateOperationPlanDto } from './create-operation-plan.dto';

export class UpdateOperationPlanDto extends PartialType(CreateOperationPlanDto) {}
