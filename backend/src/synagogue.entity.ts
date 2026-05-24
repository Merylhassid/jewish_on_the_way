import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Destination } from './destination.entity';

@Entity('synagogues')
@Index(['wikidata'])
@Index(['destination'])
@Index(['destination', 'normalizedName'])
export class Synagogue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  // Normalized name for deduplication and search
  @Column({ nullable: true })
  normalizedName?: string;

  @Column({ type: 'text', nullable: true })
  address?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: object | null;

  // Enriched fields from OSM and Wikidata
  @Column({ type: 'varchar', nullable: true, length: 500 })
  website?: string;

  @Column({ type: 'varchar', nullable: true, length: 255 })
  phone?: string;

  @Column({ type: 'varchar', nullable: true, length: 500 })
  openingHours?: string;

  @Column({ type: 'varchar', nullable: true, length: 200 })
  addrStreet?: string;

  @Column({ type: 'varchar', nullable: true, length: 50 })
  addrHousenumber?: string;

  @Column({ type: 'varchar', nullable: true, length: 50 })
  addrPostcode?: string;

  @Column({ type: 'varchar', nullable: true, length: 200 })
  addrCity?: string;

  // Wikidata QID (e.g., "Q12345")
  @Column({ type: 'varchar', nullable: true, length: 50 })
  wikidata?: string;

  // Wikipedia article title or link
  @Column({ type: 'varchar', nullable: true, length: 500 })
  wikipedia?: string;

  // Denomination (e.g., "Orthodox", "Conservative", "Reform")
  @Column({ type: 'varchar', nullable: true, length: 100 })
  denomination?: string;

  // Operator (e.g., name of organization running it)
  @Column({ type: 'varchar', nullable: true, length: 200 })
  operator?: string;

  // Source of data (e.g., "osm", "chabad", "manual")
  @Column({ default: 'osm' })
  source: string;

  // Confidence score (0-1) from import, or null if manually verified
  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  sourceConfidence?: number | null;

  // Full raw OSM tags for reference
  @Column({ type: 'jsonb', nullable: true })
  rawOsm?: Record<string, any> | null;

  // Manual verification flags
  @Column({ default: false })
  manuallyVerified: boolean;

  @Column({ default: false })
  needsLocationVerification: boolean;

  // Who/what verified the data (e.g., "admin", "community", "official")
  @Column({ type: 'varchar', nullable: true, length: 100 })
  verificationSource?: string;

  // Notes on verification or data quality
  @Column({ type: 'text', nullable: true })
  verificationNotes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @ManyToOne(() => Destination, { onDelete: 'CASCADE' })
  destination: Destination;
}
