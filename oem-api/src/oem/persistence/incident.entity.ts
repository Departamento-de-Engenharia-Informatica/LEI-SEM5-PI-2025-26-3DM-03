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
import { IncidentScope } from '../domain/incident.entity';
import { IncidentSeverity } from '../domain/incident-type.entity';
import { IncidentTypeEntity } from './incident-type.entity';
import { IncidentAffectedVveEntity } from './incident-affected-vve.entity';
import { IncidentAuditEntity } from './incident-audit.entity';

@Entity({ name: 'incidents' })
@Index('IDX_incidents_severity', ['severity'])
@Index('IDX_incidents_start_time', ['startTime'])
@Index('IDX_incidents_end_time', ['endTime'])
@Index('IDX_incidents_incident_type_id', ['incidentTypeId'])
@Index('IDX_incidents_scope', ['scope'])
export class IncidentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index('UQ_incidents_identifier', { unique: true })
  @Column({ type: 'text' })
  identifier!: string;

  @Column({ name: 'incident_type_id', type: 'integer' })
  incidentTypeId!: number;

  @ManyToOne(() => IncidentTypeEntity, (type) => type.incidents, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'incident_type_id' })
  incidentType!: IncidentTypeEntity;

  @Column({ type: 'text' })
  severity!: IncidentSeverity;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'start_time', type: 'datetime' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'datetime', nullable: true })
  endTime?: Date | null;

  @Column({ name: 'duration_minutes', type: 'integer', nullable: true })
  durationMinutes?: number | null;

  @Column({ type: 'text' })
  scope!: IncidentScope;

  @Column({ name: 'impact_from', type: 'datetime', nullable: true })
  impactFrom?: Date | null;

  @Column({ name: 'impact_to', type: 'datetime', nullable: true })
  impactTo?: Date | null;

  @Column({ name: 'created_by', type: 'text' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @OneToMany(() => IncidentAffectedVveEntity, (affected) => affected.incident, {
    cascade: false,
  })
  affectedVves?: IncidentAffectedVveEntity[];

  @OneToMany(() => IncidentAuditEntity, (audit) => audit.incident, {
    cascade: false,
  })
  auditTrail?: IncidentAuditEntity[];
}
