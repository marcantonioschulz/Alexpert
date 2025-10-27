import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.OPENAI_API_KEY = 'test-openai';
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
  process.env.JWT_SECRET = 'test-secret';
});
import {
  createConversation,
  getConversation,
  updateConversationTranscript
} from './conversationService.js';

describe('conversationService', () => {
  it('creates a conversation with default user', async () => {
    const createMock = vi.fn().mockResolvedValue({
      id: 'conversation-1',
      userId: 'demo-user',
      organizationId: 'demo-org',
      transcript: null,
      score: null,
      feedback: null,
      createdAt: new Date('2024-01-01T00:00:00Z')
    });

    const prisma = {
      conversation: {
        create: createMock
      }
    } as unknown as Parameters<typeof createConversation>[0];

    const result = await createConversation(prisma, 'demo-user', 'demo-org');

    expect(result).toEqual({
      id: 'conversation-1',
      userId: 'demo-user',
      organizationId: 'demo-org',
      transcript: null,
      score: null,
      feedback: null,
      createdAt: '2024-01-01T00:00:00.000Z'
    });
    expect(createMock).toHaveBeenCalledWith({ data: { userId: 'demo-user', organizationId: 'demo-org' } });
  });

  it('updates a transcript', async () => {
    const updateMock = vi.fn().mockResolvedValue({
      id: 'conversation-2',
      userId: 'demo-user',
      transcript: 'new transcript',
      score: null,
      feedback: null,
      createdAt: new Date('2024-01-02T00:00:00Z')
    });

    const prisma = {
      conversation: {
        update: updateMock
      }
    } as unknown as Parameters<typeof updateConversationTranscript>[0];

    const result = await updateConversationTranscript(prisma, 'conversation-2', 'new transcript');

    expect(result.transcript).toBe('new transcript');
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'conversation-2' },
      data: { transcript: 'new transcript' }
    });
  });

  it('throws a ServiceError when update target is missing', async () => {
    class PrismaClientKnownRequestError extends Error {
      constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'PrismaClientKnownRequestError';
      }
    }

    const updateMock = vi
      .fn()
      .mockRejectedValue(new PrismaClientKnownRequestError('not found', 'P2025'));

    const prisma = {
      conversation: {
        update: updateMock
      }
    } as unknown as Parameters<typeof updateConversationTranscript>[0];

    await expect(
      updateConversationTranscript(prisma, 'missing-conversation', 'text')
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Conversation not found'
    });
  });

  it('throws ServiceError when conversation is missing', async () => {
    const findUniqueMock = vi.fn().mockResolvedValue(null);

    const prisma = {
      conversation: {
        findUnique: findUniqueMock
      }
    } as unknown as Parameters<typeof getConversation>[0];

    await expect(getConversation(prisma, 'missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });
});
