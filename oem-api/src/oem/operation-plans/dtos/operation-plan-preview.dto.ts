import { ApiProperty } from '@nestjs/swagger';
import { OperationTaskPreviewDto } from './operation-task-preview.dto';

export class OperationPlanPreviewDto {
  @ApiProperty({ description: 'Source Vessel Visit Notification identifier' })
  vvnId!: string;

  @ApiProperty()
  vesselName!: string;

  @ApiProperty()
  dockId!: string;

  @ApiProperty({ description: 'Planned start timestamp in ISO-8601 format' })
  plannedStartTime!: string;

  @ApiProperty({ description: 'Planned end timestamp in ISO-8601 format' })
  plannedEndTime!: string;

  @ApiProperty({ description: 'Difference between planned end and expected departure in minutes', example: 15 })
  expectedDelayMinutes!: number | null;

  @ApiProperty({ example: 'fake-sequential' })
  algorithmUsed!: string;

  @ApiProperty({ type: OperationTaskPreviewDto, isArray: true })
  operations!: OperationTaskPreviewDto[];
}
