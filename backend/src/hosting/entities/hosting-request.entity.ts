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
import { HostingOffer } from './hosting-offer.entity';

export type HostingRequestStatus = 'pending' | 'approved' | 'rejected';

@Entity('hosting_requests')
export class HostingRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Destination, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destination_id' })
  destination: Destination;

  @ManyToOne(() => HostingOffer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'offer_id' })
  offer: HostingOffer | null;

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
  special_requests: string | null;

  @Column({ default: 'pending' })
  status: HostingRequestStatus;

  @Column({ default: true })
  is_active: boolean;

  // Explicit host reference — used when request originates from a need (offer=null)
  @Column({ type: 'int', nullable: true, name: 'host_id' })
  host_id: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
