import { ApiProperty } from '@nestjs/swagger';

export class OperationTaskPreviewDto {
  @ApiProperty({ example: 'UNLOAD' })
  type!: string;

  @ApiProperty({ example: 'CRANE-1' })
  craneId!: string;

  @ApiProperty({ example: 'YARD-1' })
  storageAreaId!: string;

    @ApiProperty({ description: 'Assigned staff identifiers', type: [String], required: false })
    staffIds?: string[];

  @ApiProperty({ description: 'ISO-8601 scheduled start time' })
  startTime!: string;

  @ApiProperty({ description: 'ISO-8601 scheduled end time' })
  endTime!: string;
}
