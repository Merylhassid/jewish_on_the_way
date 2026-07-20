import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { SearchFeedback } from './search-feedback.entity';

const DEFAULT_RETENTION_DAYS = 365;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SearchFeedbackRetentionService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SearchFeedbackRetentionService.name);
  private readonly retentionDays: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(SearchFeedback)
    private readonly feedbackRepo: Repository<SearchFeedback>,
    config: ConfigService,
  ) {
    const configuredDays = Number(
      config.get<string>('SEARCH_FEEDBACK_RETENTION_DAYS'),
    );
    this.retentionDays =
      Number.isInteger(configuredDays) && configuredDays > 0
        ? configuredDays
        : DEFAULT_RETENTION_DAYS;
  }

  onModuleInit(): void {
    void this.cleanupExpired();
    this.cleanupInterval = setInterval(
      () => void this.cleanupExpired(),
      CLEANUP_INTERVAL_MS,
    );
    this.cleanupInterval.unref?.();
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }

  async cleanupExpired(now = new Date()): Promise<number> {
    const cutoff = new Date(
      now.getTime() - this.retentionDays * 24 * 60 * 60 * 1000,
    );

    try {
      const result = await this.feedbackRepo.delete({
        createdAt: LessThan(cutoff),
      });
      const deleted = result.affected ?? 0;
      if (deleted > 0) {
        this.logger.log(`Deleted ${deleted} expired search feedback records`);
      }
      return deleted;
    } catch {
      this.logger.error('Failed to delete expired search feedback records');
      return 0;
    }
  }
}
