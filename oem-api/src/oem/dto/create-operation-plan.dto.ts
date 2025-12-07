import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OperationPlanStatus } from '../domain/operation-plan.entity';

export class CreateOperationPlanDto {
  @ApiProperty({ description: 'Name of the operation plan' })
  @IsString()
  @IsNotEmpty()
  name: string;

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
    description: 'Shift date in ISO-8601 format',
    example: '2025-12-07',
  })
  @IsString()
  @IsOptional()
  shiftDate?: string;

  @ApiProperty({
    enum: OperationPlanStatus,
    default: OperationPlanStatus.Draft,
  })
  @IsEnum(OperationPlanStatus)
  status: OperationPlanStatus = OperationPlanStatus.Draft;
}
