import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsInt } from 'class-validator';

export class SetIncidentAffectedVvesDto {
  @ApiProperty({ type: [Number], description: 'Complete list of affected VVE identifiers' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  vveIds!: number[];
}
