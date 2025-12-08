import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { OperationPlanStatus } from '../domain/operation-plan.entity';

export type PlanOperation = {
  resourceId?: string;
  resourceType?: string;
  operationType?: 'load' | 'unload' | 'move' | 'other';
  startTime?: Date;
  endTime?: Date;
};

@Entity({ name: 'operation_plans' })
export class OperationPlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  vesselVisitId?: string;

  @Column({ type: 'text', nullable: true })
  sourceVvnId?: string;

  @Column({ type: 'datetime', nullable: true })
  shiftDate?: Date;

  @Column({ type: 'datetime', nullable: true })
  targetDay?: Date;

  @Column({ type: 'text', nullable: true })
  algorithmUsed?: string;

  @Column({ type: 'text', nullable: true })
  createdBy?: string;

  @Column({ type: 'simple-json', nullable: true })
  operations?: PlanOperation[];

  @Column({ type: 'text' })
  status!: OperationPlanStatus;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
