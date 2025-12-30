import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { IncidentEntity } from './incident.entity';
import { VesselVisitExecutionEntity } from './vessel-visit-execution.entity';

@Entity({ name: 'incident_affected_vve' })
@Unique('UQ_incident_affected_vve', ['incidentId', 'vveId'])
export class IncidentAffectedVveEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'incident_id', type: 'integer' })
  incidentId!: number;

  @ManyToOne(() => IncidentEntity, (incident) => incident.affectedVves, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'incident_id' })
  incident!: IncidentEntity;

  @Column({ name: 'vve_id', type: 'integer' })
  vveId!: number;

  @ManyToOne(() => VesselVisitExecutionEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'vve_id' })
  vve!: VesselVisitExecutionEntity;
}
