import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { IncidentSeverity } from '../domain/incident-type.entity';
import { IncidentEntity } from './incident.entity';

@Entity({ name: 'incident_types' })
export class IncidentTypeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text' })
  severity!: IncidentSeverity;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @OneToMany(() => IncidentEntity, (i) => i.type)
  incidents?: IncidentEntity[];
}
