import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OperationExecutionStatus } from '../persistence/operation-plan-task.entity';

export class PlannedOperationWithExecutionDto {
  @ApiProperty({ description: 'Identifier of the planned operation' })
  id!: number;

  @ApiProperty({ description: 'Logical type/category of the operation' })
  type!: string;

  @ApiPropertyOptional({ description: 'Assigned crane identifier' })
  craneId?: string | null;

  @ApiPropertyOptional({ description: 'Storage area associated to the operation' })
  storageAreaId?: string | null;

  @ApiPropertyOptional({ description: 'Assigned staff members', type: [String] })
  staffIds?: string[] | null;

  @ApiProperty({ description: 'Planned start time in ISO-8601 format' })
  plannedStartTime!: string;

  @ApiProperty({ description: 'Planned end time in ISO-8601 format' })
  plannedEndTime!: string;

  @ApiProperty({ enum: OperationExecutionStatus })
  executionStatus!: OperationExecutionStatus;

  @ApiPropertyOptional({ description: 'Actual execution start time in ISO-8601 format' })
  actualStartTime?: string | null;

  @ApiPropertyOptional({ description: 'Actual execution end time in ISO-8601 format' })
  actualEndTime?: string | null;

  @ApiPropertyOptional({ description: 'Actual resources used during execution', type: Object })
  actualResourcesUsed?: Record<string, unknown> | null;
}
