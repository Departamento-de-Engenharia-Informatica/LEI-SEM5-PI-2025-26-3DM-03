import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IncidentStatus } from '../domain/incident.entity';
import { IncidentSeverity } from '../domain/incident-type.entity';
import { OperationPlanEntity } from './operation-plan.entity';
import { IncidentTypeEntity } from './incident-type.entity';

@Entity({ name: 'incidents' })
@Index(['operationPlanId', 'occurredAt'])
export class IncidentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', name: 'type_id' })
  typeId!: string;

  @ManyToOne(() => IncidentTypeEntity, (type) => type.incidents, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'type_id' })
  type!: IncidentTypeEntity;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text' })
  status!: IncidentStatus;

  @Column({ type: 'text' })
  severity!: IncidentSeverity;

  @Column({ type: 'datetime' })
  occurredAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt?: Date;

  @Column({ type: 'text', nullable: true, name: 'operation_plan_id' })
  operationPlanId?: string;

  @ManyToOne(() => OperationPlanEntity, (plan) => plan.incidents, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'operation_plan_id' })
  operationPlan?: OperationPlanEntity;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}
