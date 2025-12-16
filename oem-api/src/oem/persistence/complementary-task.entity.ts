import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ComplementaryTaskStatus } from '../domain/complementary-task.entity';
import { ComplementaryTaskCategoryEntity } from './complementary-task-category.entity';
import { OperationPlanEntity } from './operation-plan.entity';

@Entity({ name: 'complementary_tasks' })
@Index(['operationPlanId', 'status'])
export class ComplementaryTaskEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'integer', nullable: true, name: 'category_id' })
  categoryId?: number;

  @ManyToOne(() => ComplementaryTaskCategoryEntity, (category) => category.tasks, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category?: ComplementaryTaskCategoryEntity;

  @Column({ type: 'integer', nullable: true, name: 'operation_plan_id' })
  operationPlanId?: number;

  @ManyToOne(() => OperationPlanEntity, (plan) => plan.complementaryTasks, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'operation_plan_id' })
  operationPlan?: OperationPlanEntity;

  @Column({ type: 'text', nullable: true, name: 'assignee_id' })
  assigneeId?: string;

  @Column({ type: 'datetime', nullable: true, name: 'due_date' })
  dueDate?: Date;

  @Column({ type: 'text' })
  status!: ComplementaryTaskStatus;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}
