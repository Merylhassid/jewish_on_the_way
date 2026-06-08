import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { Destination } from '../../destination.entity';

@Entity('hosting_needs')
export class HostingNeed {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Destination, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destination_id' })
  destination: Destination;

  @Column({ type: 'date' })
  arrival_date: string;

  @Column({ type: 'date' })
  departure_date: string;

  @Column()
  guests_count: number;

  @Column({ default: false })
  with_children: boolean;

  @Column({ default: false })
  for_shabbat: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ default: true })
  is_open: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
