import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OperationPlanEntity } from './operation-plan.entity';

@Entity({ name: 'operation_plan_change_logs' })
export class OperationPlanChangeLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'operation_plan_id', type: 'text' })
  operationPlanId!: string;

  @ManyToOne(() => OperationPlanEntity, (plan) => plan.changeLogs, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'operation_plan_id' })
  operationPlan!: OperationPlanEntity;

  @Column({ name: 'changed_by', type: 'text', nullable: true })
  changedBy?: string;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'simple-json', nullable: true })
  changes?: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  warnings?: string[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
