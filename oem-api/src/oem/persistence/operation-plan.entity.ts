import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { OperationPlanStatus } from '../domain/operation-plan.entity';
import { ComplementaryTaskEntity } from './complementary-task.entity';
import { IncidentEntity } from './incident.entity';
import { VesselVisitExecutionEntity } from './vessel-visit-execution.entity';
import { OperationPlanTaskEntity } from './operation-plan-task.entity';

export type PlanOperation = {
  resourceId?: string;
  resourceType?: string;
  operationType?: 'load' | 'unload' | 'move' | 'other';
  startTime?: Date;
  endTime?: Date;
};

@Entity({ name: 'operation_plans' })
export class OperationPlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  vesselVisitId?: string;

  @Column({ type: 'text', nullable: true })
  sourceVvnId?: string;

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

  @Column({ type: 'simple-json', nullable: true })
  operations?: PlanOperation[];

  @Column({ type: 'text' })
  status!: OperationPlanStatus;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @OneToMany(() => ComplementaryTaskEntity, (task) => task.operationPlan)
  complementaryTasks?: ComplementaryTaskEntity[];

  @OneToMany(() => VesselVisitExecutionEntity, (execution) => execution.operationPlan)
  vesselVisitExecutions?: VesselVisitExecutionEntity[];

  @OneToMany(() => IncidentEntity, (incident) => incident.operationPlan)
  incidents?: IncidentEntity[];

  @OneToMany(() => OperationPlanTaskEntity, (task) => task.operationPlan, {
    cascade: true,
  })
  tasks?: OperationPlanTaskEntity[];
}
