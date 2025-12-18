import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from 'typeorm';
import { IncidentSeverity } from '../domain/incident-type.entity';
import { IncidentEntity } from './incident.entity';

@Entity({ name: 'incident_types' })
export class IncidentTypeEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index('UQ_incident_types_code', { unique: true })
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Index('IDX_incident_types_severity')
  @Column({ type: 'text' })
  severity!: IncidentSeverity;

  @Index('IDX_incident_types_parent_id')
  @ManyToOne(() => IncidentTypeEntity, (type) => type.children, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'parent_id' })
  parent?: IncidentTypeEntity | null;

  @RelationId((type: IncidentTypeEntity) => type.parent)
  parentId?: number | null;

  @OneToMany(() => IncidentTypeEntity, (type) => type.parent)
  children?: IncidentTypeEntity[];

  @OneToMany(() => IncidentEntity, (incident) => incident.type)
  incidents?: IncidentEntity[];

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}
