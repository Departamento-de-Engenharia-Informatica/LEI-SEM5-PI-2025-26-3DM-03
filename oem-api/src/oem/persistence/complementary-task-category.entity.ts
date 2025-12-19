import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ComplementaryTaskEntity } from './complementary-task.entity';

@Entity({ name: 'complementary_task_categories' })
export class ComplementaryTaskCategoryEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index('UQ_complementary_task_categories_code', { unique: true })
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'default_duration_minutes', type: 'integer', nullable: true })
  defaultDurationMinutes?: number | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @OneToMany(() => ComplementaryTaskEntity, (task) => task.category)
  tasks?: ComplementaryTaskEntity[];
}
