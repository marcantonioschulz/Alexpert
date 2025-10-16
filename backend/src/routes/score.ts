import crypto from 'node:crypto';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import fetch from 'node-fetch';
import { ConversationLogType } from '@prisma/client';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { ServiceError } from '../services/errors.js';
import { scoreConversation } from '../services/scoreService.js';

export async function scoreRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/score',
    {
      schema: {
        body: z.object({
          conversationId: z.string().optional(),
          transcript: z.string().optional(),
          stream: z.boolean().optional()
        }),
        response: {
          200: z.object({
            conversationId: z.string(),
            score: z.number(),
            feedback: z.string()
          }),
          400: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const result = await scoreConversation(
          {
            prisma,
            fetch: fetch as unknown as typeof globalThis.fetch,
            env: {
              OPENAI_API_KEY: env.OPENAI_API_KEY,
              RESPONSES_MODEL: env.RESPONSES_MODEL
            }
          },
          request.body
        );

        return reply.send(result);
      } catch (error) {
        if (error instanceof ServiceError) {
          switch (error.code) {
            case 'BAD_REQUEST':
              return reply.badRequest(error.message);
            case 'NOT_FOUND':
              return reply.notFound(error.message);
            case 'UPSTREAM_ERROR':
              request.log.error(error, 'Failed to fetch score from OpenAI');
              return reply.status(500).send({ message: error.message });
            default:
              break;
          }
        }

        throw error;
      }
    }
  );
}

function parseScorePayload(
  textContent: string,
  logger: FastifyBaseLogger
): { score: number; feedback: string } | null {
  if (!textContent) {
    return null;
  }

  try {
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as { score: number; feedback: string };
    }
  } catch (error) {
    logger.warn({ error }, 'Failed to parse score payload');
  }

  return null;
}

function extractTextFromSSE(streamContent: string): string {
  if (!streamContent) {
    return '';
  }

  const lines = streamContent.split(/\r?\n/);
  let aggregated = '';

  for (const line of lines) {
    if (!line.startsWith('data:')) {
      continue;
    }

    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') {
      continue;
    }

    try {
      const parsed = JSON.parse(data) as { type?: string; delta?: string; content?: Array<{ text?: string }>; text?: string };

      if (parsed.type === 'response.output_text.delta' && parsed.delta) {
        aggregated += parsed.delta;
      } else if (parsed.type === 'response.output_text.done') {
        if (parsed.text) {
          aggregated += parsed.text;
        }
      } else if (Array.isArray(parsed.content) && parsed.content[0]?.text) {
        aggregated += parsed.content[0].text ?? '';
      } else if (typeof parsed.text === 'string') {
        aggregated += parsed.text;
      }
    } catch (error) {
      // Ignore malformed lines
    }
  }

  return aggregated;
}

function boundScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

function createCacheKey(model: string, prompt: string, transcript: string): string {
  return crypto.createHash('sha256').update(model).update('\0').update(prompt).update('\0').update(transcript).digest('hex');
}

async function getCachedScore(
  key: string,
  logger: FastifyBaseLogger
): Promise<{ score: number; feedback: string } | null> {
  try {
    const cached = await cacheClient.get(key);
    return cached ? (JSON.parse(cached) as { score: number; feedback: string }) : null;
  } catch (error) {
    logger.warn({ error }, 'Failed to retrieve cached score');
    return null;
  }
}

async function setCachedScore(
  key: string,
  value: { score: number; feedback: string },
  logger: FastifyBaseLogger
): Promise<void> {
  try {
    await cacheClient.set(key, JSON.stringify(value));
  } catch (error) {
    logger.warn({ error }, 'Failed to store score cache');
  }
}

async function persistConversation({
  existingConversationId,
  transcript,
  score,
  feedback
}: {
  existingConversationId?: string;
  transcript: string;
  score: number;
  feedback: string;
}) {
  if (existingConversationId) {
    return prisma.conversation.update({
      where: { id: existingConversationId },
      data: { score, feedback }
    });
  }

  return prisma.conversation.create({
    data: {
      userId: 'demo-user',
      transcript,
      score,
      feedback
    }
  });
}
