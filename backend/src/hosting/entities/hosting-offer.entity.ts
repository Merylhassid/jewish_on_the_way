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

@Entity('hosting_offers')
export class HostingOffer {
  @PrimaryGeneratedColumn()
  id: number;

  // המארח
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // יעד האירוח
  @ManyToOne(() => Destination, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destination_id' })
  destination: Destination;

  @Column({ type: 'date' })
  available_from: Date;

  @Column({ type: 'date' })
  available_to: Date;

  @Column()
  max_guests: number;

  @Column({ default: false })
  allows_children: boolean;

  @Column({ default: false })
  allows_shabbat: boolean;

  @Column({ nullable: true })
  kashrut_level: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
