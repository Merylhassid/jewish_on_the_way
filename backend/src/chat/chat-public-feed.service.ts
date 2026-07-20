import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ChatMessage } from './chat-message.entity';
import { ChatMessageLike } from './chat-message-like.entity';

const COMMUNITY_CATEGORIES = new Set([
  'hotels',
  'attractions',
  'food',
  'flights',
  'entertainment',
  'transport',
  'synagogues',
  'general',
]);

@Injectable()
export class ChatPublicFeedService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly messagesRepo: Repository<ChatMessage>,
    @InjectRepository(ChatMessageLike)
    private readonly likesRepo: Repository<ChatMessageLike>,
  ) {}

  async getFeed(destinationId: number, limit = 30, offset = 0) {
    const safeLimit = Math.min(Math.max(limit || 30, 1), 50);
    const safeOffset = Math.max(offset || 0, 0);
    const messages = await this.messagesRepo.find({
      where: {
        destination: { id: destinationId },
        parentMessage: IsNull(),
      },
      order: { createdAt: 'DESC' },
      take: safeLimit,
      skip: safeOffset,
      relations: ['comments', 'comments.user'],
    });

    return this.formatPublicMessages(messages);
  }

  async getPost(destinationId: number, messageId: number) {
    const message = await this.messagesRepo.findOne({
      where: {
        id: messageId,
        destination: { id: destinationId },
        parentMessage: IsNull(),
      },
      relations: ['comments', 'comments.user'],
    });
    if (!message) throw new NotFoundException('Community post not found');

    return (await this.formatPublicMessages([message]))[0];
  }

  private async formatPublicMessages(messages: ChatMessage[]) {
    const ids = messages.map((message) => message.id);
    const likeCounts = new Map<number, number>();

    if (ids.length > 0) {
      const rows = await this.likesRepo
        .createQueryBuilder('like')
        .innerJoin('like.message', 'message')
        .select('message.id', 'messageId')
        .addSelect('COUNT(like.id)', 'likeCount')
        .where('message.id IN (:...ids)', { ids })
        .groupBy('message.id')
        .getRawMany<{ messageId: string; likeCount: string }>();

      for (const row of rows) {
        likeCounts.set(Number(row.messageId), Number(row.likeCount));
      }
    }

    return messages.map((message) => ({
      ...this.formatPublicMessage(message),
      category: this.normalizeCategory(message.category),
      comments: (message.comments ?? [])
        .slice()
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((comment) => this.formatPublicMessage(comment)),
      likeCount: likeCounts.get(message.id) ?? 0,
      likedByMe: false,
    }));
  }

  private formatPublicMessage(message: ChatMessage) {
    const lastInitial = Array.from(message.user.lastName.trim())[0];
    return {
      id: message.id,
      content: message.content,
      category: message.category ?? null,
      imageUrl: message.imageUrl ?? null,
      parentMessageId: message.parentMessage?.id ?? null,
      createdAt: message.createdAt,
      user: {
        firstName: message.user.firstName,
        lastName: lastInitial ? `${lastInitial}.` : '',
        profileImageUrl: null,
      },
    };
  }

  private normalizeCategory(value: string | null) {
    return value && COMMUNITY_CATEGORIES.has(value) ? value : 'general';
  }
}
