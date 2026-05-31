import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Destination } from '../destination.entity';

@Entity('place_requests')
@Index(['status'])
export class PlaceRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // 'restaurant' | 'synagogue'
  @Column({ name: 'entity_type', type: 'varchar', length: 20 })
  entityType: string;

  @Column({ name: 'destination_id' })
  destinationId: number;

  @ManyToOne(() => Destination, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'destination_id' })
  destination: Destination;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone: string | null;

  @Column({ name: 'website_url', type: 'varchar', length: 512, nullable: true })
  websiteUrl: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // Restaurant-specific
  @Column({ name: 'kashrut_level', type: 'varchar', length: 32, nullable: true })
  kashrutLevel: string | null;

  @Column({ name: 'restaurant_type', type: 'varchar', length: 32, nullable: true })
  restaurantType: string | null;

  // Synagogue-specific
  @Column({ type: 'varchar', length: 64, nullable: true })
  nusach: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  denomination: string | null;

  // 'pending' | 'approved' | 'rejected'
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
