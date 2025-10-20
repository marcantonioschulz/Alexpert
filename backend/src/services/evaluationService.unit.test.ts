import type { FastifyBaseLogger } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { Response } from 'node-fetch';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
  process.env.REALTIME_MODEL = 'test-realtime';
  process.env.RESPONSES_MODEL = 'test-model';
  process.env.JWT_SECRET = 'test-secret';
});
import { parseScorePayload, scoreTranscriptForUser } from './evaluationService.js';
import { openAIClient } from './openaiClient.js';

vi.mock('../lib/preferences.js', () => ({
  getUserPreferences: vi.fn(async () => ({
    userId: 'demo-user',
    realtimeModel: 'test-realtime',
    responsesModel: 'test-model',
    apiKeyOverride: 'integration-openai'
  })),
  resolveOpenAIKey: vi.fn(() => 'integration-openai')
}));

describe('evaluationService', () => {
  it('parses JSON payloads', () => {
    const logger = {
      warn: vi.fn()
    } as unknown as FastifyBaseLogger;
    const parsed = parseScorePayload('Antwort: {"score": 88, "feedback": "Nice"}', logger);
    expect(parsed).toEqual({ score: 88, feedback: 'Nice' });
  });

  it('scores transcript via OpenAI client', async () => {
    const responsePayload = {
      output: [
        {
          content: [
            {
              text: '{"score": 90, "feedback": "Sehr gut"}'
            }
          ]
        }
      ]
    };

    const responsesSpy = vi
      .spyOn(openAIClient, 'responses')
      .mockResolvedValue({
        ok: true,
        json: async () => responsePayload
      } as unknown as Response);

    const logger = {
      warn: vi.fn(),
      error: vi.fn()
    } as unknown as FastifyBaseLogger;

    const mockPromptClient = {
      promptSetting: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({
          data
        }: {
          data: {
            key: string;
            value: string;
            description?: string | null;
          };
        }) => ({
          key: data.key,
          value: data.value,
          description: data.description,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      }
    } as unknown as PrismaClient;

    const result = await scoreTranscriptForUser({
      prisma: mockPromptClient,
      transcript: 'Hallo',
      userId: 'demo-user',
      logger
    });

    expect(result).toEqual({ score: 90, feedback: 'Sehr gut', raw: '{"score": 90, "feedback": "Sehr gut"}' });
    expect(responsesSpy).toHaveBeenCalled();
    responsesSpy.mockRestore();
  });
});
