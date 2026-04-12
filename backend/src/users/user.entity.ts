import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 'user' })
  role: string; // 'user' | 'admin'

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'profile_image_url', type: 'varchar', nullable: true })
  profileImageUrl: string | null;

  // req 2.1.1 — kashrut preference (e.g. 'none' | 'rabbinate' | 'mehadrin' | 'badatz')
  @Column({ name: 'kashrut_level', type: 'varchar', nullable: true })
  kashrutLevel: string | null;

  @Column({ name: 'reset_password_token', type: 'varchar', nullable: true })
  resetPasswordToken: string | null;

  @Column({
    name: 'reset_password_expires',
    type: 'timestamptz',
    nullable: true,
  })
  resetPasswordExpires: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
