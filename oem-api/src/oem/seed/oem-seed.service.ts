import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationPlanStatus } from '../domain/operation-plan.entity';
import { OperationPlanEntity } from '../persistence/operation-plan.entity';
import {
  OperationExecutionStatus,
  OperationPlanTaskEntity,
} from '../persistence/operation-plan-task.entity';
import { VesselVisitExecutionEntity } from '../persistence/vessel-visit-execution.entity';
import { VesselExecutionStatus } from '../domain/vessel-visit-execution.entity';
import { OemVvn } from '../vvn/oem-vvn.entity';

const TARGET_VVE_ID = 7;
const TARGET_VVN_ID = 1;
const SEED_ACTOR = 'seed-bootstrap';

@Injectable()
export class OemSeedService implements OnModuleInit {
  private readonly logger = new Logger(OemSeedService.name);

  constructor(
    @InjectRepository(VesselVisitExecutionEntity)
    private readonly vveRepo: Repository<VesselVisitExecutionEntity>,
    @InjectRepository(OperationPlanEntity)
    private readonly planRepo: Repository<OperationPlanEntity>,
    @InjectRepository(OperationPlanTaskEntity)
    private readonly taskRepo: Repository<OperationPlanTaskEntity>,
    @InjectRepository(OemVvn)
    private readonly vvnRepo: Repository<OemVvn>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureExecutionChain();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to enforce execution seed: ${reason}`);
    }
  }

  private async ensureExecutionChain(): Promise<void> {
    const execution = await this.vveRepo.findOne({ where: { id: TARGET_VVE_ID } });
    if (!execution) {
      this.logger.warn(`Seed skipped: VVE ${TARGET_VVE_ID} not found.`);
      return;
    }

    const vvn = await this.vvnRepo.findOne({ where: { id: TARGET_VVN_ID } });
    if (!vvn) {
      this.logger.warn(`Seed skipped: VVN ${TARGET_VVN_ID} not found.`);
      return;
    }

    const plan = await this.ensureOperationPlan(vvn);
    await this.ensurePlanTasks(plan, vvn);
    await this.ensureExecutionLink(execution, plan);
  }

  private async ensureOperationPlan(vvn: OemVvn): Promise<OperationPlanEntity> {
    const existing = await this.planRepo.findOne({
      where: [{ sourceVvnId: TARGET_VVN_ID }, { vesselVisitId: TARGET_VVN_ID }],
      order: { updatedAt: 'DESC', createdAt: 'DESC' },
    });

    if (existing) {
      let mutated = false;

      if (
        existing.status !== OperationPlanStatus.Planned &&
        existing.status !== OperationPlanStatus.InProgress
      ) {
        existing.status = OperationPlanStatus.Planned;
        mutated = true;
      }

      if (existing.algorithmUsed !== 'single-crane') {
        existing.algorithmUsed = 'single-crane';
        mutated = true;
      }

      if (!existing.dockId) {
        existing.dockId = vvn.dockId ?? 'A-01';
        mutated = true;
      }

      if (existing.sourceVvnId !== TARGET_VVN_ID) {
        existing.sourceVvnId = TARGET_VVN_ID;
        mutated = true;
      }

      if (existing.vesselVisitId !== TARGET_VVN_ID) {
        existing.vesselVisitId = TARGET_VVN_ID;
        mutated = true;
      }

      if (mutated) {
        existing.lastUpdatedBy = SEED_ACTOR;
        await this.planRepo.save(existing);
        this.logger.log(`Seed adjusted existing plan ${existing.id} for VVN ${TARGET_VVN_ID}.`);
      }

      return existing;
    }

    const now = new Date();
    const plannedStart = vvn.eta ? new Date(vvn.eta) : new Date(now.getTime() - 30 * 60 * 1000);
    const plannedEnd = vvn.etd
      ? new Date(vvn.etd)
      : new Date(plannedStart.getTime() + 4 * 60 * 60 * 1000);

    const plan = this.planRepo.create({
      name: `${vvn.vesselName ?? 'Baseline Vessel'} plan`,
      description: 'Seeded automatically to keep executed-operations flows available.',
      vesselVisitId: TARGET_VVN_ID,
      sourceVvnId: TARGET_VVN_ID,
      dockId: vvn.dockId ?? 'A-01',
      plannedStartTime: plannedStart,
      plannedEndTime: plannedEnd,
      algorithmUsed: 'single-crane',
      status: OperationPlanStatus.Planned,
      createdBy: SEED_ACTOR,
      lastUpdatedBy: SEED_ACTOR,
    });

    const saved = await this.planRepo.save(plan);
    this.logger.log(`Seed created plan ${saved.id} for VVN ${TARGET_VVN_ID}.`);
    return saved;
  }

  private async ensurePlanTasks(plan: OperationPlanEntity, vvn: OemVvn): Promise<void> {
    const existingTasks = await this.taskRepo.find({ where: { operationPlanId: plan.id } });
    const normalizedTypes = new Set(
      existingTasks
        .map((task) => (task.type ?? '').trim().toUpperCase())
        .filter((type) => type.length > 0),
    );

    const newTasks: OperationPlanTaskEntity[] = [];
    const planStart = plan.plannedStartTime ?? vvn.eta ?? new Date();

    if (!normalizedTypes.has('UNLOAD')) {
      const start = new Date(planStart);
      const end = new Date(start.getTime() + 90 * 60 * 1000);
      newTasks.push(
        this.taskRepo.create({
          operationPlanId: plan.id,
          type: 'UNLOAD',
          craneId: 'CRANE-01',
          storageAreaId: 'DEPOT-01',
          startTime: start,
          endTime: end,
          executionStatus: OperationExecutionStatus.Planned,
        }),
      );
    }

    if (!normalizedTypes.has('LOAD')) {
      const latestExistingEnd = existingTasks.reduce<Date>((latest, task) => {
        if (!task.endTime) {
          return latest;
        }
        return task.endTime.getTime() > latest.getTime() ? task.endTime : latest;
      }, new Date(planStart));

      const lastNewEnd = newTasks.length > 0 ? newTasks[newTasks.length - 1].endTime : null;
      const base = lastNewEnd ?? latestExistingEnd;
      const start = new Date(base.getTime() + 30 * 60 * 1000);
      const end = new Date(start.getTime() + 90 * 60 * 1000);

      newTasks.push(
        this.taskRepo.create({
          operationPlanId: plan.id,
          type: 'LOAD',
          craneId: 'CRANE-02',
          storageAreaId: 'DEPOT-02',
          startTime: start,
          endTime: end,
          executionStatus: OperationExecutionStatus.Planned,
        }),
      );
    }

    if (newTasks.length > 0) {
      await this.taskRepo.save(newTasks);
      this.logger.log(`Seed added ${newTasks.length} task(s) to plan ${plan.id}.`);
    }
  }

  private async ensureExecutionLink(
    execution: VesselVisitExecutionEntity,
    plan: OperationPlanEntity,
  ): Promise<void> {
    let mutated = false;

    if (execution.operationPlanId !== plan.id) {
      execution.operationPlanId = plan.id;
      execution.operationPlan = undefined;
      mutated = true;
    }

    if (execution.status !== VesselExecutionStatus.InProgress) {
      execution.status = VesselExecutionStatus.InProgress;
      mutated = true;
    }

    if (mutated) {
      await this.vveRepo.save(execution);
      this.logger.log(`Seed linked VVE ${execution.id} to plan ${plan.id}.`);
    }
  }
}
