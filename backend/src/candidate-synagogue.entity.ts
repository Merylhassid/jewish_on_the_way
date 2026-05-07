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

export type CandidateStatus = 'pending' | 'approved' | 'rejected';

@Entity('candidate_synagogues')
@Index(['sourceId', 'destination'], { unique: true })
@Index(['wikidata'])
@Index(['status'])
@Index(['destination', 'status'])
export class CandidateSynagogue {
  @PrimaryGeneratedColumn()
  id: number;

  // Candidate name from OSM
  @Column()
  name: string;

  // Normalized name for deduplication
  @Column()
  normalizedName: string;

  // Geographic location (Point geometry)
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: object;

  // Foreign key to destination context
  @ManyToOne(() => Destination, { onDelete: 'CASCADE' })
  destination: Destination;

  // Enriched fields extracted from OSM or Wikidata
  @Column({ type: 'varchar', nullable: true, length: 500 })
  website?: string;

  @Column({ type: 'varchar', nullable: true, length: 50 })
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

  // Source of data (e.g., "osm", "chabad")
  @Column({ default: 'osm' })
  source: string;

  // OSM node/way ID or other source-specific identifier
  @Column({ type: 'varchar', nullable: true, length: 50 })
  sourceId?: string;

  // Full raw OSM tags for reference
  @Column({ type: 'jsonb', nullable: true })
  rawOsm?: Record<string, any>;

  // Confidence score (0-1) indicating data quality
  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  sourceConfidence?: number;

  // Reasons for confidence rating (e.g., "missing website", "incomplete address")
  @Column({ type: 'text', nullable: true })
  validationReasons?: string;

  // Status: pending review, approved, or rejected
  @Column({
    type: 'varchar',
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status: CandidateStatus;

  // When this candidate was approved (mapped to Synagogue)
  @Column({ type: 'timestamp', nullable: true })
  approvedAt?: Date;

  // When this candidate was rejected
  @Column({ type: 'timestamp', nullable: true })
  rejectedAt?: Date;

  // Rejection reason
  @Column({ type: 'text', nullable: true })
  rejectionReason?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
