import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import fetch from 'node-fetch';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';

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
          500: z.object({
            message: z.string()
          })
        }
      }
    },
    async (request, reply) => {
      const { conversationId, transcript: transcriptFromBody } = request.body;

      if (!conversationId && !transcriptFromBody) {
        return reply.badRequest('conversationId oder transcript erforderlich');
      }

      const conversation = conversationId
        ? await prisma.conversation.findUnique({ where: { id: conversationId } })
        : null;

      if (conversationId && !conversation) {
        return reply.notFound('Conversation not found');
      }

      const transcript = transcriptFromBody ?? conversation?.transcript;

      if (!transcript) {
        return reply.badRequest('Kein Transkript vorhanden');
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
        request.log.error({ errorText }, 'Failed to fetch score from OpenAI');
        return reply.status(500).send({ message: 'Score request failed' });
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
        request.log.warn({ error }, 'Failed to parse score payload');
      }

      if (!parsed) {
        return reply.status(500).send({ message: 'Antwort konnte nicht interpretiert werden' });
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
    }
  );
}
