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

  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Column({ name: 'google_id', type: 'varchar', nullable: true, unique: true })
  googleId: string | null;

  @Column({ name: 'apple_id', type: 'varchar', nullable: true, unique: true })
  appleId: string | null;

  @Column({ name: 'facebook_id', type: 'varchar', nullable: true, unique: true })
  facebookId: string | null;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ default: true })
  isActive: boolean;

  // Admin-imposed disable (distinct from isActive, which tracks email
  // verification / self-deletion) — must survive email re-verification.
  @Column({ name: 'is_disabled', default: false })
  isDisabled: boolean;

  @Column({ default: 'user' })
  role: string; // 'user' | 'admin'

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'profile_image_url', type: 'varchar', nullable: true })
  profileImageUrl: string | null;

  // req 2.1.1 — kashrut preference (e.g. 'none' | 'rabbinate' | 'mehadrin' | 'badatz')
  @Column({ name: 'kashrut_level', type: 'varchar', nullable: true })
  kashrutLevel: string | null;

  @Column({ name: 'refresh_token', type: 'varchar', length: 64, nullable: true })
  refreshToken: string | null;

  @Column({ name: 'refresh_token_expires_at', type: 'timestamptz', nullable: true })
  refreshTokenExpiresAt: Date | null;

  @Column({ name: 'reset_password_token', type: 'varchar', nullable: true })
  resetPasswordToken: string | null;

  @Column({ name: 'push_token', type: 'varchar', length: 512, nullable: true })
  pushToken: string | null;

  @Column({
    name: 'reset_password_expires',
    type: 'timestamptz',
    nullable: true,
  })
  resetPasswordExpires: Date | null;

  @Column({ name: 'email_verification_code', type: 'varchar', length: 64, nullable: true })
  emailVerificationCode: string | null = null;

  @Column({ name: 'email_verification_expires', type: 'timestamptz', nullable: true })
  emailVerificationExpires: Date | null = null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
