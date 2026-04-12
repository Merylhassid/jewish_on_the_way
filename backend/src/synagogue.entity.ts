import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Destination } from './destination.entity';

@Entity('synagogues')
export class Synagogue {
  @PrimaryGeneratedColumn()
  id: number;

  // Unique ID from external source: "osm:123456" or "google:ChIJ..."
  @Column({ name: 'external_id', nullable: true, unique: true })
  externalId?: string;

  @Column()
  name: string;

  // 'synagogue' | 'chabad' | 'beth_hamidrash' | 'other'
  @Column({ default: 'synagogue' })
  type: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ name: 'opening_hours', type: 'text', nullable: true })
  openingHours?: string;

  @Column({ name: 'phone_number', nullable: true })
  phoneNumber?: string;

  @Column({ name: 'website', nullable: true })
  website?: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: object;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Destination, { onDelete: 'CASCADE' })
  destination: Destination;
}
