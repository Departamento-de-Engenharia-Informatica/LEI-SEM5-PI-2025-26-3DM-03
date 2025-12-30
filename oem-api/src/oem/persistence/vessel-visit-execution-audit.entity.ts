import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VesselVisitExecutionEntity } from './vessel-visit-execution.entity';

@Entity({ name: 'vessel_visit_execution_audit' })
export class VesselVisitExecutionAuditEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'vve_id', type: 'integer' })
  vveId!: number;

  @ManyToOne(() => VesselVisitExecutionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vve_id' })
  vesselVisitExecution!: VesselVisitExecutionEntity;

  @CreateDateColumn({ name: 'changed_at', type: 'datetime' })
  changedAt!: Date;

  @Column({ name: 'changed_by', type: 'text' })
  changedBy!: string;

  @Column({ type: 'text' })
  action!: string;

  @Column({ type: 'simple-json' })
  before!: Record<string, unknown>;

  @Column({ type: 'simple-json' })
  after!: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  note?: string;
}
