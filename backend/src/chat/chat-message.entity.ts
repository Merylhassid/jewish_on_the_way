import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
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

  @Column({ type: 'varchar', length: 40, nullable: true })
  category: string | null;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl: string | null;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Destination, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'destination_id' })
  destination: Destination | null;

  @ManyToOne(() => Minyan, { onDelete: 'CASCADE', nullable: true, eager: false })
  @JoinColumn({ name: 'minyan_id' })
  minyan: Minyan | null;

  @ManyToOne(() => ChatMessage, (message) => message.comments, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_message_id' })
  parentMessage: ChatMessage | null;

  @OneToMany(() => ChatMessage, (message) => message.parentMessage)
  comments: ChatMessage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
