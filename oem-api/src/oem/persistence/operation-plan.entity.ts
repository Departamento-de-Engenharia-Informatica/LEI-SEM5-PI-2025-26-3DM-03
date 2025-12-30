import { Column, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { OperationPlanStatus } from '../domain/operation-plan.entity';
import { VesselVisitExecutionEntity } from './vessel-visit-execution.entity';
import { OperationPlanTaskEntity } from './operation-plan-task.entity';
import { OperationPlanChangeLogEntity } from './operation-plan-change-log.entity';

export type PlanOperation = {
  resourceId?: string;
  resourceType?: string;
  operationType?: 'load' | 'unload' | 'move' | 'other';
  startTime?: Date;
  endTime?: Date;
};

@Entity({ name: 'operation_plans' })
export class OperationPlanEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'integer', nullable: true })
  vesselVisitId?: number;

  @Column({ type: 'integer', nullable: true })
  sourceVvnId?: number;

  @Column({ name: 'dock_id', type: 'text', nullable: true })
  dockId?: string;

  @Column({ type: 'datetime', nullable: true })
  shiftDate?: Date;

  @Column({ type: 'datetime', nullable: true })
  targetDay?: Date;

  @Column({ name: 'planned_start_time', type: 'datetime', nullable: true })
  plannedStartTime?: Date;

  @Column({ name: 'planned_end_time', type: 'datetime', nullable: true })
  plannedEndTime?: Date;

  @Column({ type: 'text', nullable: true })
  algorithmUsed?: string;

  @Column({ type: 'text', nullable: true })
  createdBy?: string;

  @Column({ type: 'text', nullable: true })
  lastUpdatedBy?: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt?: Date;

  @Column({ name: 'last_change_reason', type: 'text', nullable: true })
  lastChangeReason?: string;

  @Column({ name: 'last_change_warnings', type: 'simple-json', nullable: true })
  lastChangeWarnings?: string[];

  @Column({ type: 'simple-json', nullable: true })
  operations?: PlanOperation[];

  @Column({ type: 'text' })
  status!: OperationPlanStatus;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @OneToMany(() => VesselVisitExecutionEntity, (execution) => execution.operationPlan)
  vesselVisitExecutions?: VesselVisitExecutionEntity[];

  @OneToMany(() => OperationPlanTaskEntity, (task) => task.operationPlan, {
    cascade: true,
  })
  tasks?: OperationPlanTaskEntity[];

  @OneToMany(() => OperationPlanChangeLogEntity, (log) => log.operationPlan, {
    cascade: true,
  })
  changeLogs?: OperationPlanChangeLogEntity[];
}
