import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('user_favorites')
@Index(['userId', 'entityType', 'entityId'], { unique: true })
export class UserFavorite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'entity_type', type: 'varchar', length: 20 })
  entityType: 'restaurant' | 'synagogue';

  @Column({ name: 'entity_id', type: 'integer' })
  entityId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
