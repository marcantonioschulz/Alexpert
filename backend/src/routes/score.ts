import crypto from 'node:crypto';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import fetch from 'node-fetch';
import { ConversationLogType } from '@prisma/client';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { getUserPreferences, resolveOpenAIKey } from '../lib/preferences.js';

const systemPrompt = `Bewerte dieses Verkaufsgespräch nach Klarheit, Bedarfsermittlung, Einwandbehandlung.
Antworte ausschließlich als JSON im Format {"score": number, "feedback": string}.`;

export async function scoreRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/score',
    {
      schema: {
        body: z.object({
          conversationId: z.string().optional(),
          transcript: z.string().optional(),
          userId: z.string().optional()
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
      const { conversationId, transcript: transcriptFromBody } = request.body;
      const userId = request.body.userId ?? 'demo-user';
      const preferences = await getUserPreferences(userId);
      const apiKey = resolveOpenAIKey(preferences);
      const model = preferences.responsesModel ?? env.RESPONSES_MODEL;

      if (!conversationId && !transcriptFromBody) {
        return reply.badRequest('conversationId oder transcript erforderlich');
      }

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

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          input: [
            {
              role: 'system',
              content: [
                {
                  type: 'text',
                  text: systemPrompt
                }
              ]
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: transcript
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        request.log.error({ errorText }, 'Failed to fetch score from OpenAI');
        return reply.status(500).send({ message: 'Score request failed' });
      }

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

      const boundedScore = Math.min(100, Math.max(0, Math.round(parsed.score)));

      const updatedConversation = conversationId
        ? await prisma.conversation.update({
            where: { id: conversationId },
            data: { score: boundedScore, feedback: parsed.feedback }
          })
        : await prisma.conversation.create({
            data: {
              userId,
              transcript,
              score: boundedScore,
              feedback: parsed.feedback
            }
          });

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
