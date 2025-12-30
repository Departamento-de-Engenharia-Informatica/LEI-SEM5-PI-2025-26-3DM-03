import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ComplementaryTaskMode } from '../domain/complementary-task.entity';
import { ComplementaryTaskCategoryEntity } from './complementary-task-category.entity';
import { VesselVisitExecutionEntity } from './vessel-visit-execution.entity';
import { ComplementaryTaskAuditEntity } from './complementary-task-audit.entity';

@Entity({ name: 'complementary_task' })
@Index('IDX_complementary_task_vve_id', ['vveId'])
@Index('IDX_complementary_task_category_id', ['categoryId'])
@Index('IDX_complementary_task_start_time', ['startTime'])
@Index('IDX_complementary_task_end_time', ['endTime'])
@Index('IDX_complementary_task_mode', ['mode'])
export class ComplementaryTaskEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index('UQ_complementary_task_identifier', { unique: true })
  @Column({ type: 'text' })
  identifier!: string;

  @Column({ name: 'category_id', type: 'integer' })
  categoryId!: number;

  @ManyToOne(() => ComplementaryTaskCategoryEntity, (category) => category.tasks, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category!: ComplementaryTaskCategoryEntity;

  @Column({ name: 'vve_id', type: 'integer' })
  vveId!: number;

  @ManyToOne(() => VesselVisitExecutionEntity, (vve) => vve.complementaryTasks, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'vve_id' })
  vve!: VesselVisitExecutionEntity;

  @Column({ type: 'text' })
  team!: string;

  @Column({ type: 'text' })
  mode!: ComplementaryTaskMode;

  @Column({ name: 'start_time', type: 'datetime' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'datetime', nullable: true })
  endTime?: Date | null;

  @Column({ name: 'duration_minutes', type: 'integer', nullable: true })
  durationMinutes?: number | null;

  @Column({ name: 'created_by', type: 'text' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @OneToMany(() => ComplementaryTaskAuditEntity, (audit) => audit.task)
  auditTrail?: ComplementaryTaskAuditEntity[];
}
