import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OperationPlanEntity } from './operation-plan.entity';

export enum OperationExecutionStatus {
  Planned = 'PLANNED',
  Started = 'STARTED',
  Completed = 'COMPLETED',
  Delayed = 'DELAYED',
}

@Entity({ name: 'operation_plan_tasks' })
export class OperationPlanTaskEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'operation_plan_id', type: 'integer' })
  operationPlanId!: number;

  @ManyToOne(() => OperationPlanEntity, (plan) => plan.tasks, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'operation_plan_id' })
  operationPlan!: OperationPlanEntity;

  @Column({ type: 'text' })
  type!: string;

  @Column({ name: 'crane_id', type: 'text', nullable: true })
  craneId?: string;

  @Column({ name: 'storage_area_id', type: 'text', nullable: true })
  storageAreaId?: string;

  @Column({ name: 'staff_ids', type: 'simple-json', nullable: true })
  staffIds?: string[];

  @Column({ name: 'start_time', type: 'datetime' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'datetime' })
  endTime!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt?: Date | null;

  @Column({ name: 'execution_status', type: 'text', default: OperationExecutionStatus.Planned })
  executionStatus!: OperationExecutionStatus;

  @Column({ name: 'actual_start_time', type: 'datetime', nullable: true })
  actualStartTime?: Date | null;

  @Column({ name: 'actual_end_time', type: 'datetime', nullable: true })
  actualEndTime?: Date | null;

  @Column({ name: 'actual_resources_used', type: 'simple-json', nullable: true })
  actualResourcesUsed?: Record<string, unknown> | null;
}
