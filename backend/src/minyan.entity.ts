import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Destination } from './destination.entity';
import { User } from './users/user.entity';

// Forward reference to avoid circular import
export type MinyanRegistrationRef = { id: number };

@Entity('minyans')
export class Minyan {
  @PrimaryGeneratedColumn()
  id: number;

  // 'shacharit' | 'mincha' | 'maariv' | 'musaf' | 'other'
  @Column({ name: 'prayer_type' })
  prayerType: string;

  @Column({ type: 'date' })
  date: string; // ISO date string: "2026-04-20"

  @Column({ length: 5 })
  time: string; // "HH:MM"

  @Column({ name: 'location_text', type: 'text' })
  locationText: string;

  // req 8.2 — optional coordinates so we can show distance to user
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lat: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lng: number | null;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'participants_count', default: 1 })
  participantsCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Destination, (destination) => destination.minyans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destination_id' })
  destination: Destination;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @OneToMany('MinyanRegistration', 'minyan')
  registrations: MinyanRegistrationRef[];
}
