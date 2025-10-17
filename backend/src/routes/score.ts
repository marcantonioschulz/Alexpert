import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import fetch from 'node-fetch';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { getUserPreferences, resolveOpenAIKey } from '../lib/preferences.js';
import { ServiceError } from '../services/errors.js';
import { ConversationLogType } from '../types/index.js';
import { errorResponseSchema, sendErrorResponse } from './error-response.js';

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
      try {
        const { conversationId, transcript: transcriptFromBody } = request.body;
        const userId = request.body.userId ?? 'demo-user';
        const preferences = await getUserPreferences(userId);
        const apiKey = resolveOpenAIKey(preferences);
        const model = preferences.responsesModel ?? env.RESPONSES_MODEL;

        if (!conversationId && !transcriptFromBody) {
          throw new ServiceError(
            'BAD_REQUEST',
            'conversationId oder transcript erforderlich'
          );
        }

        const existingConversation = conversationId
          ? await prisma.conversation.findUnique({ where: { id: conversationId } })
          : null;

        if (conversationId && !existingConversation) {
          throw new ServiceError('NOT_FOUND', 'Conversation not found');
        }

        const transcript = transcriptFromBody ?? existingConversation?.transcript ?? '';

        if (!transcript) {
          throw new ServiceError('BAD_REQUEST', 'Kein Transkript vorhanden');
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

          throw new ServiceError('UPSTREAM_ERROR', 'Score request failed', {
            cause: new Error(errorText)
          });
        }

        const responseText = await response.text();
        const lines = responseText.split('\n\n');
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
            const parsed = JSON.parse(data) as {
              type?: string;
              delta?: string;
              content?: Array<{ text?: string }>;
              text?: string;
            };

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

        const parsed = parseScorePayload(aggregated, request.log);

        if (!parsed) {
          request.log.error({ aggregated }, 'Failed to parse score payload');

          throw new ServiceError(
            'UPSTREAM_ERROR',
            'Antwort konnte nicht interpretiert werden'
          );
        }

        const boundedScore = Math.min(100, Math.max(0, Math.round(parsed.score)));

        const persistedConversation = await persistConversation({
          existingConversationId: conversationId,
          userId,
          transcript,
          score: boundedScore,
          feedback: parsed.feedback
        });

        await prisma.conversationLog.create({
          data: {
            conversationId: persistedConversation.id,
            role: 'system',
            type: ConversationLogType.SCORING_CONTEXT,
            content: aggregated,
            context: {
              feedback: parsed.feedback,
              score: boundedScore
            }
          }
        });

        const result = {
          conversationId: persistedConversation.id,
          score: boundedScore,
          feedback: parsed.feedback
        };

        return reply.send(result);
      } catch (error) {
        if (error instanceof ServiceError) {
          switch (error.code) {
            case 'BAD_REQUEST':
              return sendErrorResponse(
                reply,
                400,
                'score.bad_request',
                error.message
              );
            case 'NOT_FOUND':
              return sendErrorResponse(
                reply,
                404,
                'score.not_found',
                error.message,
                { conversationId: request.body.conversationId }
              );
            case 'UPSTREAM_ERROR':
              request.log.error({ error }, 'Failed to fetch score from OpenAI');
              return sendErrorResponse(
                reply,
                500,
                'score.upstream_error',
                error.message
              );
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

async function persistConversation({
  existingConversationId,
  transcript,
  score,
  feedback,
  userId
}: {
  existingConversationId?: string;
  transcript: string;
  score: number;
  feedback: string;
  userId: string;
}) {
  if (existingConversationId) {
    return prisma.conversation.update({
      where: { id: existingConversationId },
      data: { score, feedback }
    });
  }

  return prisma.conversation.create({
    data: {
      userId,
      transcript,
      score,
      feedback
    }
  });
}
