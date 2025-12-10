import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OperationPlanEntity } from './operation-plan.entity';

@Entity({ name: 'operation_plan_tasks' })
export class OperationPlanTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'operation_plan_id', type: 'text' })
  operationPlanId!: string;

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

  @Column({ name: 'start_time', type: 'datetime' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'datetime' })
  endTime!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
