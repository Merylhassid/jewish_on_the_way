import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
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

  // PostGIS location (lat/lng)
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: object;

  @Column()
  country: string;

  @Column()
  city: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @OneToMany(() => Restaurant, (restaurant) => restaurant.destination)
  restaurants: Restaurant[];

  @OneToMany(() => Minyan, (minyan) => minyan.destination)
  minyans: Minyan[];

  @OneToMany(() => HostingOffer, (offer) => offer.destination)
  hostingOffers: HostingOffer[];
}
