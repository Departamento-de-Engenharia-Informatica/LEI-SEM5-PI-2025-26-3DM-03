import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OperationExecutionStatus } from '../persistence/operation-plan-task.entity';

export class ExecutedOperationDto {
  @ApiProperty({ description: 'Identifier of the planned operation linked to this execution' })
  plannedOperationId!: number;

  @ApiPropertyOptional({ description: 'Actual start time in ISO-8601 format', type: String })
  actualStartTime?: string | null;

  @ApiPropertyOptional({ description: 'Actual end time in ISO-8601 format', type: String })
  actualEndTime?: string | null;

  @ApiPropertyOptional({ description: 'Resources used during execution', type: Object })
  resourcesUsed?: Record<string, unknown> | null;

  @ApiProperty({ enum: OperationExecutionStatus })
  executionStatus!: OperationExecutionStatus;
}
