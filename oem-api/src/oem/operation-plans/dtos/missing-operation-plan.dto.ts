import { ApiProperty } from '@nestjs/swagger';

export class MissingOperationPlanDto {
  @ApiProperty({ description: 'VVN identifier' })
  id!: number;

  @ApiProperty({ description: 'Vessel name' })
  vesselName!: string;

  @ApiProperty({ description: 'Dock identifier' })
  dockId!: string;

  @ApiProperty({ description: 'Estimated time of arrival (ISO-8601)' })
  eta!: string;

  @ApiProperty({ description: 'Estimated time of departure (ISO-8601)', required: false })
  etd?: string | null;

  @ApiProperty({ description: 'Cargo/container count (approximate)' })
  containers!: number;

  @ApiProperty({ description: 'VVN status' })
  status!: string;
}
