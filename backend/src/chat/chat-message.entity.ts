import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Destination } from '../destination.entity';
import { Minyan } from '../minyan.entity';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  content: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Destination, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'destination_id' })
  destination: Destination | null;

  @ManyToOne(() => Minyan, { onDelete: 'CASCADE', nullable: true, eager: false })
  @JoinColumn({ name: 'minyan_id' })
  minyan: Minyan | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
