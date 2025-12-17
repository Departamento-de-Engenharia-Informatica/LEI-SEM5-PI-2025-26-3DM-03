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
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'identifier', type: 'text', unique: true })
  identifier!: string;

  @Column({ name: 'vvn_id', type: 'text' })
  vvnId!: string;

  @Column({ name: 'vesselName', type: 'text' })
  vesselIdentifier!: string;

  @Column({ type: 'text', nullable: true })
  voyageNumber?: string;

  @Column({ type: 'integer', nullable: true, name: 'operation_plan_id' })
  operationPlanId?: number;

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

  @Column({ name: 'actual_arrival_time', type: 'datetime' })
  actualArrivalTime!: Date;

  @Column({ name: 'created_by', type: 'text' })
  createdBy!: string;

  @Column({ type: 'text', default: 'in-progress' })
  status!: VesselExecutionStatus;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}
