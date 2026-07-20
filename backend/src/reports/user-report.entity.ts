import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../users/user.entity';

export type UserReportContext = 'hosting_chat' | 'hosting_offer' | 'community';
export type UserReportStatus = 'open' | 'resolved';

@Entity('user_reports')
@Index(['status'])
@Index(['reportedUserId'])
export class UserReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reporter_id' })
  reporterId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Column({ name: 'reported_user_id' })
  reportedUserId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reported_user_id' })
  reportedUser: User;

  @Column({ type: 'varchar', length: 20 })
  context: UserReportContext;

  @Column({ name: 'entity_id', type: 'integer' })
  entityId: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: UserReportStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
