import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';
import { VesselVisitExecutionEntity } from '../persistence/vessel-visit-execution.entity';
import { VesselVisitExecutionService } from '../services';

class LinkVveToPlanDto {
  @Type(() => Number)
  @IsInt()
  vveId!: number;
}

class LinkVveToPlanResponseDto {
  vveId!: number;
  vvn!: number | null;
  operationPlanId!: number | null;
}

@ApiTags('Dev Seed')
@Controller('dev/seed')
export class DevSeedController {
  constructor(private readonly vveService: VesselVisitExecutionService) {}

  // DEV SEED – temporary, safe to remove before production
  @Post('link-vve-to-plan')
  @ApiOperation({ summary: '[Dev] Associate an existing VVE to a compatible operation plan' })
  @ApiOkResponse({ type: LinkVveToPlanResponseDto })
  async linkVveToPlan(@Body() payload: LinkVveToPlanDto): Promise<LinkVveToPlanResponseDto> {
    const updated = await this.vveService.seedLinkExistingVveToPlan(payload.vveId);
    const vvn = this.resolveNumericVvn(updated);

    return {
      vveId: updated.id,
      vvn,
      operationPlanId: updated.operationPlanId ?? null,
    };
  }

  private resolveNumericVvn(vve: VesselVisitExecutionEntity): number | null {
    const candidates: Array<string | number | null | undefined> = [
      vve.vesselVisitId,
      vve.vvnId,
    ];

    for (const candidate of candidates) {
      if (candidate == null) continue;
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return null;
  }
}
