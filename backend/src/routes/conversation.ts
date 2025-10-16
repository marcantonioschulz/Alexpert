import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import type { ConversationDto, ConversationResponse } from '../types/index.js';
import { errorResponseSchema, sendErrorResponse } from './error-response.js';

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
          500: errorResponseSchema
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
      } catch (err) {
        request.log.error({ err, route: 'conversation:start' });

        const message =
          err instanceof Error ? err.message : 'Unknown error while creating conversation';

        return sendErrorResponse(reply, 500, 'conversation.create_failed', message);
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
          }),
          404: errorResponseSchema,
          500: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const conversation = await prisma.conversation.findUnique({
          where: { id: request.params.id }
        });

        if (!conversation) {
          return sendErrorResponse(
            reply,
            404,
            'conversation.not_found',
            'Conversation not found',
            { conversationId: request.params.id }
          );
        }

        const updatedConversation = await prisma.conversation.update({
          where: { id: request.params.id },
          data: { transcript: request.body.transcript }
        });

        return reply.send(formatConversation(updatedConversation));
      } catch (err) {
        request.log.error({ err, route: 'conversation:updateTranscript' });

        const message =
          err instanceof Error ? err.message : 'Failed to update conversation transcript';

        return sendErrorResponse(reply, 500, 'conversation.transcript_update_failed', message, {
          conversationId: request.params.id
        });
      }
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
          }),
          404: errorResponseSchema,
          500: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const conversation = await prisma.conversation.findUnique({
          where: { id: request.params.id }
        });

        if (!conversation) {
          return sendErrorResponse(
            reply,
            404,
            'conversation.not_found',
            'Conversation not found',
            { conversationId: request.params.id }
          );
        }

        return reply.send(formatConversation(conversation));
      } catch (err) {
        request.log.error({ err, route: 'conversation:get' });

        const message = err instanceof Error ? err.message : 'Failed to fetch conversation';

        return sendErrorResponse(reply, 500, 'conversation.fetch_failed', message, {
          conversationId: request.params.id
        });
      }
    }
  );
}

function formatConversation(conversation: ConversationResponse): ConversationDto {
  return {
    ...conversation,
    createdAt: conversation.createdAt.toISOString()
  };
}
