import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('place_reports')
@Index(['entityType', 'entityId'])
@Index(['status'])
export class PlaceReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'entity_type', type: 'varchar', length: 20 })
  entityType: 'restaurant' | 'synagogue';

  @Column({ name: 'entity_id', type: 'integer' })
  entityId: number;

  // 'not_kosher' | 'closed' | 'moved' | 'wrong_info' | 'other'
  @Column({ name: 'report_type', type: 'varchar', length: 50 })
  reportType: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // 'pending' | 'reviewed' | 'resolved'
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
