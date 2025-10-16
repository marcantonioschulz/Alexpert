import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import fetch from 'node-fetch';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
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
          transcript: z.string().optional()
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

        if (!conversationId && !transcriptFromBody) {
          return sendErrorResponse(
            reply,
            400,
            'score.transcript_required',
            'conversationId oder transcript erforderlich'
          );
        }

        const conversation = conversationId
          ? await prisma.conversation.findUnique({ where: { id: conversationId } })
          : null;

        if (conversationId && !conversation) {
          return sendErrorResponse(
            reply,
            404,
            'score.conversation_not_found',
            'Conversation not found',
            { conversationId }
          );
        }

        const transcript = transcriptFromBody ?? conversation?.transcript;

        if (!transcript) {
          return sendErrorResponse(
            reply,
            400,
            'score.transcript_missing',
            'Kein Transkript vorhanden',
            conversationId ? { conversationId } : undefined
          );
        }

        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: env.RESPONSES_MODEL,
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
          request.log.error({ err: errorText, route: 'score:evaluate', status: response.status });
          return sendErrorResponse(reply, 500, 'score.request_failed', 'Score request failed', {
            conversationId,
            status: response.status
          });
        }

        const payload = (await response.json()) as Record<string, unknown> & {
          output?: Array<{
            content?: Array<{
              text?: string;
            }>;
          }>;
          content?: Array<{
            text?: string;
          }>;
        };

        const textContent =
          payload.output?.[0]?.content?.[0]?.text ??
          payload.content?.[0]?.text ??
          '';

        let parsed: { score: number; feedback: string } | null = null;

        try {
          const jsonMatch = textContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]) as { score: number; feedback: string };
          }
        } catch (error) {
          request.log.warn({ error, route: 'score:evaluate' }, 'Failed to parse score payload');
        }

        if (!parsed) {
          return sendErrorResponse(
            reply,
            500,
            'score.parse_failed',
            'Antwort konnte nicht interpretiert werden',
            conversationId ? { conversationId } : undefined
          );
        }

        const boundedScore = Math.min(100, Math.max(0, Math.round(parsed.score)));

        const updatedConversation = conversationId
          ? await prisma.conversation.update({
              where: { id: conversationId },
              data: { score: boundedScore, feedback: parsed.feedback }
            })
          : await prisma.conversation.create({
              data: {
                userId: 'demo-user',
                transcript,
                score: boundedScore,
                feedback: parsed.feedback
              }
            });

        return reply.send({
          conversationId: updatedConversation.id,
          score: boundedScore,
          feedback: parsed.feedback
        });
      } catch (err) {
        request.log.error({ err, route: 'score:evaluate' });
        const message = err instanceof Error ? err.message : 'Score request failed';
        return sendErrorResponse(reply, 500, 'score.request_failed', message);
      }
    }
  );
}
