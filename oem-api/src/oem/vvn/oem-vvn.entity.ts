import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'oem_vvn' })
export class OemVvn {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'vessel_name', type: 'text' })
  vesselName!: string;

  @Column({ name: 'dock_id', type: 'text' })
  dockId!: string;

  @Column({ type: 'datetime' })
  eta!: Date;

  @Column({ type: 'datetime', nullable: true })
  etd?: Date;

  @Column({ type: 'int' })
  containers!: number;

  @Column({ type: 'text', default: 'APPROVED' })
  status!: string;
}
