import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OperationPlanStatus } from '../domain/operation-plan.entity';

class PlanOperationDto {
  @ApiPropertyOptional({ description: 'Resource identifier' })
  @IsString()
  @IsOptional()
  resourceId?: string;

  @ApiPropertyOptional({ description: 'Resource type (crane, staff, storage, etc.)' })
  @IsString()
  @IsOptional()
  resourceType?: string;

  @ApiPropertyOptional({
    description: 'Type of operation',
    enum: ['load', 'unload', 'move', 'other'],
  })
  @IsString()
  @IsOptional()
  operationType?: 'load' | 'unload' | 'move' | 'other';

  @ApiPropertyOptional({ description: 'Start time', type: String, format: 'date-time' })
  @IsISO8601()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ description: 'End time', type: String, format: 'date-time' })
  @IsISO8601()
  @IsOptional()
  endTime?: string;
}

export class CreateOperationPlanDto {
  @ApiProperty({ description: 'Name of the operation plan' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Detailed description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Identifier of the related vessel visit',
    example: 'vessel-visit-123',
  })
  @IsString()
  @IsOptional()
  vesselVisitId?: string;

  @ApiPropertyOptional({
    description: 'VVN identifier that originated this plan',
    example: 'vvn-123',
  })
  @IsString()
  @IsOptional()
  sourceVvnId?: string;

  @ApiPropertyOptional({
    description: 'Shift date in ISO-8601 format',
    example: '2025-12-07',
  })
  @IsString()
  @IsOptional()
  shiftDate?: string;

  @ApiPropertyOptional({
    description: 'Day targeted for plan generation (ISO date)',
    example: '2025-12-07',
  })
  @IsISO8601()
  @IsOptional()
  targetDay?: string;

  @ApiPropertyOptional({
    description: 'Dock assigned to the plan',
    example: 'A',
  })
  @IsString()
  @IsOptional()
  dockId?: string;

  @ApiPropertyOptional({
    description: 'Planned start timestamp in ISO-8601 format',
    example: '2025-12-07T08:00:00Z',
  })
  @IsISO8601()
  @IsOptional()
  plannedStartTime?: string;

  @ApiPropertyOptional({
    description: 'Planned end timestamp in ISO-8601 format',
    example: '2025-12-07T12:00:00Z',
  })
  @IsISO8601()
  @IsOptional()
  plannedEndTime?: string;

  @ApiPropertyOptional({
    description: 'Scheduling algorithm used',
    example: 'optimal',
  })
  @IsString()
  @IsOptional()
  algorithmUsed?: string;

  @ApiPropertyOptional({
    description: 'User who created the plan',
  })
  @IsString()
  @IsOptional()
  createdBy?: string;

  @ApiPropertyOptional({
    description: 'Operations that compose the plan',
    type: PlanOperationDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanOperationDto)
  @IsOptional()
  operations?: PlanOperationDto[];

  @ApiProperty({
    enum: OperationPlanStatus,
    default: OperationPlanStatus.Draft,
  })
  @IsEnum(OperationPlanStatus)
  status: OperationPlanStatus = OperationPlanStatus.Draft;
}
