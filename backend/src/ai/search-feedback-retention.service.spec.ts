import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchFeedbackRetentionService } from './search-feedback-retention.service';

describe('SearchFeedbackRetentionService', () => {
  const makeService = (configuredDays?: string) => {
    const feedbackRepo = { delete: jest.fn() };
    const config = {
      get: jest.fn().mockReturnValue(configuredDays),
    } as unknown as ConfigService;
    const service = new SearchFeedbackRetentionService(
      feedbackRepo as any,
      config,
    );
    return { service, feedbackRepo };
  };

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('runs on startup, repeats daily, and stops on module shutdown', async () => {
    jest.useFakeTimers();
    const { service } = makeService('365');
    const cleanupSpy = jest
      .spyOn(service, 'cleanupExpired')
      .mockResolvedValue(0);

    service.onModuleInit();
    expect(cleanupSpy).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(cleanupSpy).toHaveBeenCalledTimes(2);

    service.onModuleDestroy();
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(cleanupSpy).toHaveBeenCalledTimes(2);
  });

  it('deletes records older than the configured retention period', async () => {
    const { service, feedbackRepo } = makeService('365');
    feedbackRepo.delete.mockResolvedValue({ affected: 4 });
    const now = new Date('2026-07-19T12:00:00.000Z');

    await expect(service.cleanupExpired(now)).resolves.toBe(4);

    const criteria = feedbackRepo.delete.mock.calls[0][0];
    expect(criteria.createdAt.type).toBe('lessThan');
    expect(criteria.createdAt.value).toEqual(
      new Date('2025-07-19T12:00:00.000Z'),
    );
  });

  it('falls back to 365 days when the configuration is invalid', async () => {
    const { service, feedbackRepo } = makeService('invalid');
    feedbackRepo.delete.mockResolvedValue({ affected: 0 });
    const now = new Date('2026-07-19T12:00:00.000Z');

    await service.cleanupExpired(now);

    const criteria = feedbackRepo.delete.mock.calls[0][0];
    expect(criteria.createdAt.value).toEqual(
      new Date('2025-07-19T12:00:00.000Z'),
    );
  });

  it('logs only the number of deleted records', async () => {
    const { service, feedbackRepo } = makeService('365');
    feedbackRepo.delete.mockResolvedValue({ affected: 3 });
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await service.cleanupExpired(new Date('2026-07-19T12:00:00.000Z'));

    expect(logSpy).toHaveBeenCalledWith(
      'Deleted 3 expired search feedback records',
    );
  });

  it('does not crash the application when cleanup fails', async () => {
    const { service, feedbackRepo } = makeService('365');
    feedbackRepo.delete.mockRejectedValue(new Error('database unavailable'));
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();

    await expect(
      service.cleanupExpired(new Date('2026-07-19T12:00:00.000Z')),
    ).resolves.toBe(0);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to delete expired search feedback records',
    );
  });
});
