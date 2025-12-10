import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VesselExecutionStatus } from '../domain/vessel-visit-execution.entity';
import { OperationPlanEntity } from './operation-plan.entity';

@Entity({ name: 'vessel_visit_executions' })
@Index(['operationPlanId', 'status'])
export class VesselVisitExecutionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  vesselName!: string;

  @Column({ type: 'text', nullable: true })
  voyageNumber?: string;

  @Column({ type: 'text', nullable: true, name: 'operation_plan_id' })
  operationPlanId?: string;

  @ManyToOne(() => OperationPlanEntity, (plan) => plan.vesselVisitExecutions, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'operation_plan_id' })
  operationPlan?: OperationPlanEntity;

  @Column({ type: 'datetime', nullable: true })
  eta?: Date;

  @Column({ type: 'datetime', nullable: true })
  etd?: Date;

  @Column({ type: 'text' })
  status!: VesselExecutionStatus;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}
