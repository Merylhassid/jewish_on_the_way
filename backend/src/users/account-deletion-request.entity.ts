import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('account_deletion_requests')
@Index('IDX_account_deletion_requests_token_hash', ['tokenHash'], {
  unique: true,
})
@Index('IDX_account_deletion_requests_user_id', ['userId'])
@Index('IDX_account_deletion_requests_expires_at', ['expiresAt'])
export class AccountDeletionRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
