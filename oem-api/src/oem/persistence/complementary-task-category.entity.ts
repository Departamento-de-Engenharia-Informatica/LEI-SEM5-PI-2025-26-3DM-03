import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ComplementaryTaskEntity } from './complementary-task.entity';

@Entity({ name: 'complementary_task_categories' })
export class ComplementaryTaskCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @OneToMany(() => ComplementaryTaskEntity, (task) => task.category)
  tasks?: ComplementaryTaskEntity[];
}
