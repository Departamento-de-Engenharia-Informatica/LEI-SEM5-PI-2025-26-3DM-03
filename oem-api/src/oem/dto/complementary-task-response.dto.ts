import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ComplementaryTaskMode,
  ComplementaryTaskStatus,
} from '../domain/complementary-task.entity';

export class ComplementaryTaskResponseDto {
  @ApiProperty({ description: 'Database identifier' })
  id!: number;

  @ApiProperty({ description: 'Business identifier (e.g. CT-2025-0001)' })
  identifier!: string;

  @ApiProperty({ description: 'Complementary task category id' })
  categoryId!: number;

  @ApiProperty({ description: 'Vessel visit execution id' })
  vveId!: number;

  @ApiProperty({ description: 'Responsible team or service' })
  team!: string;

  @ApiProperty({ enum: ComplementaryTaskMode })
  mode!: ComplementaryTaskMode;

  @ApiProperty({ description: 'Task start timestamp in ISO-8601' })
  startTime!: string;

  @ApiPropertyOptional({ description: 'Task completion timestamp in ISO-8601' })
  endTime?: string | null;

  @ApiPropertyOptional({ description: 'Duration in minutes once completed' })
  durationMinutes?: number | null;

  @ApiProperty({ enum: ComplementaryTaskStatus, description: 'Derived task status' })
  status!: ComplementaryTaskStatus;

  @ApiProperty({ description: 'Whether the task is currently impacting operations' })
  isImpactingNow!: boolean;

  @ApiProperty({ description: 'User who created the task' })
  createdBy!: string;

  @ApiProperty({ description: 'Creation timestamp in ISO-8601' })
  createdAt!: string;

  @ApiProperty({ description: 'Last update timestamp in ISO-8601' })
  updatedAt!: string;
}
