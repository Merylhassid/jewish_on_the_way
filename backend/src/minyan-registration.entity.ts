import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './users/user.entity';
import { Minyan } from './minyan.entity';

@Entity('minyan_registrations')
@Unique(['userId', 'minyanId']) // req 6.4.1 — prevent duplicate registration
export class MinyanRegistration {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'minyan_id' })
  minyanId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Minyan, 'registrations', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'minyan_id' })
  minyan: Minyan;

  @CreateDateColumn({ name: 'registered_at' })
  registeredAt: Date;
}
