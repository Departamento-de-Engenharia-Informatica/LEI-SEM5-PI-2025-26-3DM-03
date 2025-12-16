import { Injectable } from '@nestjs/common';
import { OperationPlanEntity } from '../persistence/operation-plan.entity';
import { OemVvn } from '../vvn/oem-vvn.entity';
import { OperationPlanService } from './operation-plan.service';

/**
 * Facade para as operações de “missing plans”, delegando no OperationPlanService.
 * Mantém a lógica de geração/associação de VVNs num único lugar.
 */
@Injectable()
export class MissingOperationPlansService {
  constructor(private readonly plans: OperationPlanService) {}

  findMissingForDay(date: string): Promise<OemVvn[]> {
    return this.plans.findMissingPlansForDay(date);
  }

  regenerateMissingForDay(
    date: string,
    algorithm = 'single-crane',
    createdBy?: string,
    confirmOverwrite?: boolean,
  ): Promise<OperationPlanEntity[]> {
    return this.plans.regenerateMissingForDay(date, algorithm, createdBy, confirmOverwrite);
  }
}
