import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  RelationId,
} from 'typeorm';
import { Restaurant } from './restaurant.entity';
import { Minyan } from './minyan.entity';
import { HostingOffer } from './hosting/entities/hosting-offer.entity';
import { HostingRequest } from './hosting/entities/hosting-request.entity';

@Entity('destinations')
export class Destination {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column()
  country: string;

  // ISO 3166-1 alpha-2 country code (e.g. "FR", "IL") — used for flag emoji on client
  @Column({ name: 'country_code', length: 2 })
  countryCode: string;

  @Column()
  city: string;

  @Column({ name: 'name_he', nullable: true, type: 'varchar', length: 128 })
  nameHe?: string | null;

  // PostGIS location (lat/lng) — req 3.1.2
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: object;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Parent/child destination hierarchy
  @ManyToOne(() => Destination, (destination) => destination.children, {
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent?: Destination;

  @RelationId((destination: Destination) => destination.parent)
  parentId?: number;

  @OneToMany(() => Destination, (destination) => destination.parent)
  children: Destination[];

  // Relations
  @OneToMany(() => Restaurant, (restaurant) => restaurant.destination)
  restaurants: Restaurant[];

  @OneToMany(() => Minyan, (minyan) => minyan.destination)
  minyans: Minyan[];

  @OneToMany(() => HostingOffer, (offer) => offer.destination)
  hostingOffers: HostingOffer[];
}
