import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ComplementaryTaskEntity } from './complementary-task.entity';

@Entity({ name: 'complementary_task_audit' })
export class ComplementaryTaskAuditEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'task_id', type: 'integer' })
  taskId!: number;

  @ManyToOne(() => ComplementaryTaskEntity, (task) => task.auditTrail, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'task_id' })
  task!: ComplementaryTaskEntity;

  @CreateDateColumn({ name: 'changed_at', type: 'datetime' })
  changedAt!: Date;

  @Column({ name: 'changed_by', type: 'text' })
  changedBy!: string;

  @Column({ type: 'text' })
  action!: string;

  @Column({ type: 'simple-json', nullable: true })
  before?: Record<string, unknown> | null;

  @Column({ type: 'simple-json', nullable: true })
  after?: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  note?: string | null;
}
