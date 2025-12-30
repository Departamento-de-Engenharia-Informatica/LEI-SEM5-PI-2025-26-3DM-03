import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OperationPlanEntity } from '../../persistence/operation-plan.entity';
import { OperationPlanChangeLogEntity } from '../../persistence/operation-plan-change-log.entity';

export class OperationPlanUpdateResponseDto {
  @ApiProperty({ type: OperationPlanEntity })
  plan!: OperationPlanEntity;

  @ApiProperty({ type: [String] })
  warnings!: string[];

  @ApiPropertyOptional({ type: OperationPlanChangeLogEntity })
  logEntry?: OperationPlanChangeLogEntity;
}
