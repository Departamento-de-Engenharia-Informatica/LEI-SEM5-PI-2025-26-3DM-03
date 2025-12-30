import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';

export const resourceAllocationResourceTypes = ['crane', 'dock', 'staff'] as const;
export type ResourceAllocationResourceType = (typeof resourceAllocationResourceTypes)[number];

export class ResourceAllocationQueryDto {
  @ApiProperty({
    description: 'Start of the analysis period (inclusive)',
    example: '2025-12-01T00:00:00Z',
  })
  @IsISO8601()
  from!: string;

  @ApiProperty({
    description: 'End of the analysis period (exclusive)',
    example: '2025-12-02T00:00:00Z',
  })
  @IsISO8601()
  to!: string;

  @ApiProperty({
    description: 'Type of resource to aggregate',
    enum: resourceAllocationResourceTypes,
    example: 'crane',
  })
  @IsEnum(resourceAllocationResourceTypes)
  resourceType!: ResourceAllocationResourceType;

  @ApiPropertyOptional({ description: 'Optional identifier of the resource to filter' })
  @IsString()
  @IsOptional()
  resourceId?: string;

  get fromDate(): Date {
    return this.parseIsoDate(this.from, 'from');
  }

  get toDate(): Date {
    return this.parseIsoDate(this.to, 'to');
  }

  private parseIsoDate(value: string, field: 'from' | 'to'): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ISO-8601 date supplied for "${field}".`);
    }
    return date;
  }
}

export class ResourceAllocationSummaryDto {
  @ApiProperty({ enum: resourceAllocationResourceTypes })
  resourceType!: ResourceAllocationResourceType;

  @ApiProperty({ description: 'Identifier of the resource' })
  resourceId!: string;

  @ApiProperty({ description: 'Total allocation time expressed in minutes', example: 480 })
  totalAllocatedMinutes!: number;

  @ApiProperty({ description: 'Total allocation time expressed in hours', example: 8 })
  totalAllocatedHours!: number;

  @ApiProperty({ description: 'Number of operations that involve this resource', example: 5 })
  operationCount!: number;
}
