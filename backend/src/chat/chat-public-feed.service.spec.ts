import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatMessage } from './chat-message.entity';
import { ChatMessageLike } from './chat-message-like.entity';
import { ChatPublicFeedService } from './chat-public-feed.service';

describe('ChatPublicFeedService', () => {
  const messagesRepo = { find: jest.fn(), findOne: jest.fn() };
  const getRawMany = jest.fn();
  const likesRepo = {
    createQueryBuilder: jest.fn(() => ({
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany,
    })),
  };
  let service: ChatPublicFeedService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ChatPublicFeedService,
        { provide: getRepositoryToken(ChatMessage), useValue: messagesRepo },
        { provide: getRepositoryToken(ChatMessageLike), useValue: likesRepo },
      ],
    }).compile();
    service = module.get(ChatPublicFeedService);
  });

  it('returns a redacted read-only feed without user ids or profile images', async () => {
    const createdAt = new Date('2026-07-20T10:00:00Z');
    messagesRepo.find.mockResolvedValue([{
      id: 11,
      content: 'Welcome',
      category: 'general',
      imageUrl: null,
      parentMessage: null,
      createdAt,
      user: { id: 7, firstName: 'David', lastName: 'Cohen', profileImageUrl: 'private.jpg' },
      comments: [{
        id: 12,
        content: 'Thanks',
        category: null,
        imageUrl: null,
        parentMessage: { id: 11 },
        createdAt,
        user: { id: 8, firstName: 'שרה', lastName: 'לוי', profileImageUrl: 'private2.jpg' },
      }],
    }]);
    getRawMany.mockResolvedValue([{ messageId: '11', likeCount: '3' }]);

    const result = await service.getFeed(5);

    expect(result[0].likeCount).toBe(3);
    expect(result[0].likedByMe).toBe(false);
    expect(result[0].user).toEqual({ firstName: 'David', lastName: 'C.', profileImageUrl: null });
    expect(result[0].comments[0].user).toEqual({ firstName: 'שרה', lastName: 'ל.', profileImageUrl: null });
    expect(result[0].user).not.toHaveProperty('id');
    expect(result[0]).not.toHaveProperty('likedBy');
  });

  it('returns 404 when a public post does not belong to the destination', async () => {
    messagesRepo.findOne.mockResolvedValue(null);
    await expect(service.getPost(5, 99)).rejects.toBeInstanceOf(NotFoundException);
  });
});
