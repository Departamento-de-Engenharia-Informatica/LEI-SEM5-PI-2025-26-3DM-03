import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { VesselVisitExecutionEntity } from './vessel-visit-execution.entity';
import { OperationPlanTaskEntity } from './operation-plan-task.entity';

@Entity({ name: 'executed_operations' })
@Unique(['vveId', 'plannedOperationId'])
export class ExecutedOperationEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'vve_id', type: 'integer' })
  vveId!: number;

  @ManyToOne(() => VesselVisitExecutionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vve_id' })
  vesselVisitExecution!: VesselVisitExecutionEntity;

  @Column({ name: 'planned_operation_id', type: 'integer' })
  plannedOperationId!: number;

  @ManyToOne(() => OperationPlanTaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'planned_operation_id' })
  plannedOperation!: OperationPlanTaskEntity;

  @Column({ name: 'actual_start_time', type: 'datetime', nullable: true })
  actualStartTime?: Date | null;

  @Column({ name: 'actual_end_time', type: 'datetime', nullable: true })
  actualEndTime?: Date | null;

  @Column({ name: 'resources_used', type: 'simple-json', nullable: true })
  resourcesUsed?: Record<string, unknown> | null;

  @Column({ name: 'created_by', type: 'text' })
  createdBy!: string;

  @Column({ name: 'updated_by', type: 'text', nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
