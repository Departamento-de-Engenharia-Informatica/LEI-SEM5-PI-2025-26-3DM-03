import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDomainEntity } from './base-domain.entity';

export enum ComplementaryTaskStatus {
  Pending = 'pending',
  InProgress = 'in-progress',
  Done = 'done',
  Blocked = 'blocked',
}

/**
 * Represents an auxiliary task associated with an operation execution.
 */
export class ComplementaryTask extends BaseDomainEntity {
  @ApiProperty({ description: 'Task title' })
  title: string;

  @ApiPropertyOptional({ description: 'Task details' })
  description?: string;

  @ApiProperty({ description: 'Category identifier' })
  categoryId: number;

  @ApiPropertyOptional({ description: 'Related operation plan id' })
  operationPlanId?: number;

  @ApiProperty({ enum: ComplementaryTaskStatus })
  status: ComplementaryTaskStatus;

  @ApiPropertyOptional({ description: 'User assigned to the task' })
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Due date' })
  dueDate?: Date;

  constructor(init?: Partial<ComplementaryTask>) {
    super(init);
    this.title = init?.title ?? '';
    this.description = init?.description;
    this.categoryId = init?.categoryId ?? 0;
    this.operationPlanId = init?.operationPlanId;
    this.status = init?.status ?? ComplementaryTaskStatus.Pending;
    this.assigneeId = init?.assigneeId;
    this.dueDate = init?.dueDate;
  }
}
