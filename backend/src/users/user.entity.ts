import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

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

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'kashrut_pref', nullable: true })
  kashrutPref?: string;

  @Column({ name: 'profile_image_url', nullable: true })
  profileImageUrl?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
