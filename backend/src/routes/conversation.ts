import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import type { ConversationDto, ConversationResponse, ErrorResponse } from '../types/index.js';

const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  context: z.record(z.any()).optional()
});

export async function conversationRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/start',
    {
      schema: {
        body: z
          .object({
            userId: z.string().optional()
          })
          .optional()
          .nullable(),
        response: {
          200: z.object({ conversationId: z.string() }),
          500: errorResponseSchema satisfies z.ZodType<ErrorResponse>
        }
      }
    },
    async (request, reply) => {
      try {
        const conversation = await prisma.conversation.create({
          data: {
            userId: request.body?.userId ?? 'demo-user'
          }
        });

        return reply.send({ conversationId: conversation.id });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to create conversation');
        throw error;
      }
    }
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/conversation/:id/transcript',
    {
      schema: {
        params: z.object({
          id: z.string()
        }),
        body: z.object({
          transcript: z.string().min(1)
        }),
        response: {
          200: z.object({
            id: z.string(),
            transcript: z.string().nullable(),
            score: z.number().nullable(),
            feedback: z.string().nullable(),
            createdAt: z.string()
          })
        }
      }
    },
    async (request, reply) => {
      const conversation = await prisma.conversation.update({
        where: { id: request.params.id },
        data: { transcript: request.body.transcript }
      });

      return reply.send(formatConversation(conversation));
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/conversation/:id',
    {
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            transcript: z.string().nullable(),
            score: z.number().nullable(),
            feedback: z.string().nullable(),
            createdAt: z.string()
          })
        }
      }
    },
    async (request, reply) => {
      const conversation = await prisma.conversation.findUnique({
        where: { id: request.params.id }
      });

      if (!conversation) {
        return reply.notFound('Conversation not found');
      }

      return reply.send(formatConversation(conversation));
    }
  );
}

function formatConversation(conversation: ConversationResponse): ConversationDto {
  return {
    ...conversation,
    createdAt: conversation.createdAt.toISOString()
  };
}
