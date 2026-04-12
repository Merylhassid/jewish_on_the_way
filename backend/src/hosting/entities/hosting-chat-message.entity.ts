import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { HostingRequest } from './hosting-request.entity';

@Entity('hosting_chat_messages')
export class HostingChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => HostingRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request: HostingRequest;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
