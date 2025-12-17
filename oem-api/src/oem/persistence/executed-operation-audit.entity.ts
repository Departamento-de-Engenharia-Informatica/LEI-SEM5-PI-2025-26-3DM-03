import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ExecutedOperationEntity } from './executed-operation.entity';

@Entity({ name: 'executed_operation_audit' })
export class ExecutedOperationAuditEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'executed_operation_id', type: 'integer' })
  executedOperationId!: number;

  @ManyToOne(() => ExecutedOperationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'executed_operation_id' })
  executedOperation!: ExecutedOperationEntity;

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
}
