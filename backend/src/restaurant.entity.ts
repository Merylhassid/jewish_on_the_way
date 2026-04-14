import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Destination } from './destination.entity';

@Entity('restaurants')
export class Restaurant {
  @PrimaryGeneratedColumn()
  id: number;

  // Used to avoid inserting duplicates from Google Places
  @Column({ name: 'google_place_id', nullable: true, unique: true })
  googlePlaceId?: string;

  @Column()
  name: string;

  // 'meat' | 'dairy' | 'pareve' — req 4.2
  @Column({ name: 'restaurant_type', type: 'varchar', length: 32, nullable: true })
  restaurantType: string | null;

  // Confidence score for restaurant type classification (0-1)
  @Column({ name: 'restaurant_type_confidence', type: 'decimal', precision: 3, scale: 2, nullable: true })
  restaurantTypeConfidence?: number;

  // 'rabbinate' | 'mehadrin' | 'badatz' — req 4.2.1
  @Column({ name: 'kashrut_level' })
  kashrutLevel: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  // Free text, e.g. "Sun-Thu 12:00-22:00, Fri 12:00-14:00" — req 4.1.1
  @Column({ name: 'opening_hours', type: 'text', nullable: true })
  openingHours?: string;

  // PostGIS location (lat/lng) — req 4.1.1
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: object;

  // Google Places rating (0-5)
  @Column({ type: 'decimal', precision: 2, scale: 1, nullable: true })
  rating?: number;

  // Whether this restaurant is confirmed kosher
  @Column({ name: 'is_kosher', default: false })
  isKosher: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Destination, (destination) => destination.restaurants, {
    onDelete: 'CASCADE',
  })
  destination: Destination;
}
