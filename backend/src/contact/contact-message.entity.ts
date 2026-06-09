import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('contact_messages')
export class ContactMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column()
  email: string;

  @Column({ length: 100 })
  subject: string;

  @Column({ type: 'text' })
  message: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
