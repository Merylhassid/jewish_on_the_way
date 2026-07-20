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
  @Column({
    name: 'restaurant_type',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  restaurantType: string | null;

  // Confidence score for restaurant type classification (0-1)
  @Column({
    name: 'restaurant_type_confidence',
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
  })
  restaurantTypeConfidence?: number;

  // 'rabbinate' | 'mehadrin' | 'badatz' — req 4.2.1
  @Column({ name: 'kashrut_level' })
  kashrutLevel: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  country?: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone?: string;

  // e.g. "French", "Italian", "Sushi", "Middle Eastern"
  @Column({ type: 'varchar', length: 128, nullable: true })
  category?: string;

  // Free text, e.g. "Sun-Thu 12:00-22:00, Fri 12:00-14:00" — req 4.1.1
  @Column({ name: 'opening_hours', type: 'text', nullable: true })
  openingHours?: string;

  // Raw coordinates stored for reference — set once during geocoding, never updated
  @Column({ type: 'double precision', nullable: true })
  lat?: number;

  @Column({ type: 'double precision', nullable: true })
  lng?: number;

  // Timestamp of last successful geocoding — null means not yet geocoded
  @Column({ name: 'geocoded_at', type: 'timestamptz', nullable: true })
  geocodedAt?: Date;

  // PostGIS location — filled by geocoding backfill script, nullable until then
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: object | null;

  // Google Places rating (0-5)
  @Column({ type: 'decimal', precision: 2, scale: 1, nullable: true })
  rating?: number;

  // Whether this restaurant is confirmed kosher
  @Column({ name: 'is_kosher', default: false })
  isKosher: boolean;

  // ── Enrichment fields ──────────────────────────────────────────────────────

  @Column({ name: 'website_url', type: 'varchar', nullable: true })
  websiteUrl?: string;

  @Column({ name: 'website_text', type: 'text', nullable: true })
  websiteText?: string;

  @Column({ name: 'website_opening_hours', type: 'text', nullable: true })
  websiteOpeningHours?: string;

  @Column({
    name: 'website_last_fetched_at',
    type: 'timestamptz',
    nullable: true,
  })
  websiteLastFetchedAt?: Date;

  @Column({
    name: 'website_fetch_status',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  websiteFetchStatus?: string;

  @Column({ name: 'enrichment_source_summary', type: 'text', nullable: true })
  enrichmentSourceSummary?: string;

  // ── Kosher validation (legacy columns — ikr.org.il data is pre-validated) ──

  @Column({
    name: 'kosher_validation_status',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  kosherValidationStatus?: string;

  @Column({
    name: 'kosher_validation_confidence',
    type: 'decimal',
    precision: 4,
    scale: 3,
    nullable: true,
  })
  kosherValidationConfidence?: number;

  @Column({ name: 'kosher_validation_reason', type: 'text', nullable: true })
  kosherValidationReason?: string;

  @Column({ name: 'kosher_validated_at', type: 'timestamptz', nullable: true })
  kosherValidatedAt?: Date;

  // ── Google Places verification / enrichment (shadow fields) ────────────────
  // Google data is stored alongside existing fields; the enrichment pipeline
  // gates overwrites of name/address/phone/etc. by verification confidence.

  @Column({ name: 'google_display_name', type: 'text', nullable: true })
  googleDisplayName?: string;

  @Column({ name: 'google_formatted_address', type: 'text', nullable: true })
  googleFormattedAddress?: string;

  @Column({ name: 'google_display_name_he', type: 'text', nullable: true })
  googleDisplayNameHe?: string;

  @Column({ name: 'google_formatted_address_he', type: 'text', nullable: true })
  googleFormattedAddressHe?: string;

  @Column({ name: 'google_display_name_en', type: 'text', nullable: true })
  googleDisplayNameEn?: string;

  @Column({ name: 'google_formatted_address_en', type: 'text', nullable: true })
  googleFormattedAddressEn?: string;

  @Column({ name: 'google_lat', type: 'double precision', nullable: true })
  googleLat?: number;

  @Column({ name: 'google_lng', type: 'double precision', nullable: true })
  googleLng?: number;

  @Column({
    name: 'google_business_status',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  googleBusinessStatus?: string;

  @Column({ name: 'google_maps_uri', type: 'text', nullable: true })
  googleMapsUri?: string;

  @Column({ name: 'google_rating_count', type: 'int', nullable: true })
  googleRatingCount?: number;

  @Column({ name: 'google_synced_at', type: 'timestamptz', nullable: true })
  googleSyncedAt?: Date;

  // Added by 1783300000000 — Google shadow values kept separate from originals.
  @Column({
    name: 'google_rating',
    type: 'decimal',
    precision: 2,
    scale: 1,
    nullable: true,
  })
  googleRating?: number;

  @Column({ name: 'google_phone', type: 'varchar', length: 32, nullable: true })
  googlePhone?: string;

  @Column({ name: 'google_opening_hours', type: 'text', nullable: true })
  googleOpeningHours?: string;

  @Column({ name: 'google_photo_name', type: 'text', nullable: true })
  googlePhotoName?: string;

  @Column({ name: 'google_photo_attribution', type: 'text', nullable: true })
  googlePhotoAttribution?: string;

  @Column({
    name: 'google_primary_type',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  googlePrimaryType?: string;

  @Column({ name: 'google_types', type: 'text', nullable: true })
  googleTypes?: string;

  // 'pending' | 'verified' | 'flagged' | 'no_match' | 'error'
  @Column({
    name: 'verification_status',
    type: 'varchar',
    length: 16,
    default: 'pending',
  })
  verificationStatus: string;

  @Column({
    name: 'verification_confidence',
    type: 'decimal',
    precision: 4,
    scale: 3,
    nullable: true,
  })
  verificationConfidence?: number;

  @Column({ name: 'verification_reason', type: 'text', nullable: true })
  verificationReason?: string;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl?: string;

  @Column({ name: 'photo_attribution', type: 'text', nullable: true })
  photoAttribution?: string;

  @Column({ name: 'photo_source', type: 'varchar', length: 32, nullable: true })
  photoSource?: string;

  @Column({ name: 'photo_fetched_at', type: 'timestamptz', nullable: true })
  photoFetchedAt?: Date;

  // Food-concept tags derived from name + category — used for tiered smart search
  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Destination, (destination) => destination.restaurants, {
    onDelete: 'CASCADE',
  })
  destination: Destination;
}
