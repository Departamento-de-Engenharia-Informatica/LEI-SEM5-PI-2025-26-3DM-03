import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IncidentEntity } from './incident.entity';

@Entity({ name: 'incident_audit' })
export class IncidentAuditEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'incident_id', type: 'integer' })
  incidentId!: number;

  @ManyToOne(() => IncidentEntity, (incident) => incident.auditTrail, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'incident_id' })
  incident!: IncidentEntity;

  @CreateDateColumn({ name: 'changed_at', type: 'datetime' })
  changedAt!: Date;

  @Column({ name: 'changed_by', type: 'text' })
  changedBy!: string;

  @Column({ type: 'text' })
  action!: string;

  @Column({ type: 'text', nullable: true })
  before?: string | null;

  @Column({ type: 'text', nullable: true })
  after?: string | null;

  @Column({ type: 'text', nullable: true })
  note?: string | null;
}
