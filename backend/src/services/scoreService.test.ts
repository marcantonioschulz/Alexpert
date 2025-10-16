import { describe, expect, it, vi } from 'vitest';
import { scoreConversation } from './scoreService.js';

const baseEnv = {
  OPENAI_API_KEY: 'key',
  RESPONSES_MODEL: 'model'
};

describe('scoreService', () => {
  it('throws when neither conversationId nor transcript provided', async () => {
    const prisma = {
      conversation: {}
    };

    const fetchMock = vi.fn();

    await expect(
      scoreConversation(
        {
          prisma: prisma as never,
          fetch: fetchMock as unknown as typeof fetch,
          env: baseEnv
        },
        {}
      )
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('throws when conversation not found', async () => {
    const prisma = {
      conversation: {
        findUnique: vi.fn().mockResolvedValue(null)
      }
    };

    const fetchMock = vi.fn();

    await expect(
      scoreConversation(
        {
          prisma: prisma as never,
          fetch: fetchMock as unknown as typeof fetch,
          env: baseEnv
        },
        { conversationId: 'missing' }
      )
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('creates a new conversation when none provided', async () => {
    const createMock = vi.fn().mockResolvedValue({
      id: 'new-conversation'
    });

    const prisma = {
      conversation: {
        findUnique: vi.fn(),
        create: createMock
      }
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            content: [
              {
                text: '{"score": 82, "feedback": "Nice job"}'
              }
            ]
          }
        ]
      }),
      text: async () => ''
    });

    const result = await scoreConversation(
      {
        prisma: prisma as never,
        fetch: fetchMock as unknown as typeof fetch,
        env: baseEnv
      },
      { transcript: 'hello world' }
    );

    expect(result).toEqual({
      conversationId: 'new-conversation',
      score: 82,
      feedback: 'Nice job'
    });
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        transcript: 'hello world',
        score: 82,
        feedback: 'Nice job'
      })
    });
  });

  it('updates existing conversation with bounded score', async () => {
    const findUniqueMock = vi.fn().mockResolvedValue({
      transcript: 'existing transcript'
    });
    const updateMock = vi.fn().mockResolvedValue({
      id: 'existing-id'
    });

    const prisma = {
      conversation: {
        findUnique: findUniqueMock,
        update: updateMock
      }
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            content: [
              {
                text: '{"score": 150, "feedback": "Too high"}'
              }
            ]
          }
        ]
      }),
      text: async () => ''
    });

    const result = await scoreConversation(
      {
        prisma: prisma as never,
        fetch: fetchMock as unknown as typeof fetch,
        env: baseEnv
      },
      { conversationId: 'existing-id' }
    );

    expect(result).toEqual({
      conversationId: 'existing-id',
      score: 100,
      feedback: 'Too high'
    });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'existing-id' },
      data: { score: 100, feedback: 'Too high' }
    });
  });
});
