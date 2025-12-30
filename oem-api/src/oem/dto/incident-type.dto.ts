import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentSeverity } from '../domain/incident-type.entity';

export class IncidentTypeDto {
  @ApiProperty({ description: 'Unique identifier' })
  id!: number;

  @ApiProperty({ description: 'Stable code for the incident type', example: 'T-INC001' })
  code!: string;

  @ApiProperty({ description: 'Display name' })
  name!: string;

  @ApiPropertyOptional({ description: 'Optional description', nullable: true })
  description?: string | null;

  @ApiProperty({ enum: IncidentSeverity })
  severity!: IncidentSeverity;

  @ApiPropertyOptional({ description: 'Identifier of the parent incident type', nullable: true })
  parentId?: number | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiPropertyOptional({ description: 'Last update timestamp', nullable: true })
  updatedAt?: Date | null;
}

export class IncidentTypeTreeDto extends IncidentTypeDto {
  @ApiPropertyOptional({
    description: 'Children incident types in hierarchy order',
    type: () => [IncidentTypeTreeDto],
    nullable: true,
  })
  children?: IncidentTypeTreeDto[];
}
