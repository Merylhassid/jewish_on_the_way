import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Stores every AI search + which restaurant the user clicked.
 * These rows become few-shot examples for the next Claude call —
 * making the classifier genuinely learn from user behaviour.
 */
@Entity('search_feedback')
export class SearchFeedback {
  @PrimaryGeneratedColumn()
  id: number;

  /** The raw text the user typed */
  @Column({ type: 'text' })
  query: string;

  /** What Claude extracted from the query */
  @Column({ type: 'varchar', nullable: true })
  detectedType: string | null;

  @Column({ type: 'varchar', nullable: true })
  detectedKashrut: string | null;

  @Column({ type: 'varchar', nullable: true })
  detectedKeyword: string | null;

  /** What the user actually clicked (null = no click recorded yet) */
  @Column({ type: 'varchar', nullable: true })
  clickedRestaurantName: string | null;

  @Column({ type: 'varchar', nullable: true })
  clickedRestaurantType: string | null;

  @Column({ type: 'varchar', nullable: true })
  clickedRestaurantKashrut: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
