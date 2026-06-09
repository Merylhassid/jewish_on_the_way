import { Column, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('chat_cursors')
@Unique(['roomKey', 'userId'])
export class ChatCursor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'room_key' })
  roomKey: string;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'first_name', default: '' })
  firstName: string;

  @Column({ name: 'last_name', default: '' })
  lastName: string;

  @Column({ name: 'last_read_id', default: 0 })
  lastReadId: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
