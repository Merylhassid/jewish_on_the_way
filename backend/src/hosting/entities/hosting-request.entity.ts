import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';

import { User } from '../../users/user.entity';
import { Destination } from '../../destination.entity';

@Entity('hosting_requests')
export class HostingRequest {
  @PrimaryGeneratedColumn()
  id: number;

  // מי שמבקש להתארח
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // יעד הבקשה
  @ManyToOne(() => Destination, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destination_id' })
  destination: Destination;

  @Column({ type: 'date' })
  arrival_date: Date;

  @Column({ type: 'date' })
  departure_date: Date;

  @Column()
  guests_count: number;

  @Column({ default: false })
  with_children: boolean;

  @Column({ default: false })
  for_shabbat: boolean;

  @Column({ type: 'text', nullable: true })
  special_requests: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
