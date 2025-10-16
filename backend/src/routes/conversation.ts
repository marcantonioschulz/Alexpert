import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ConversationLogType } from '@prisma/client';
import { z } from 'zod';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { ServiceError } from '../services/errors.js';
import {
  createConversation,
  getConversation,
  updateConversationTranscript
} from '../services/conversationService.js';
import {
  errorResponseSchema,
  sendErrorResponse,
  type ErrorResponse
} from './error-response.js';

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
        const conversation = await createConversation(prisma, request.body?.userId);
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
        const conversation = await prisma.$transaction(async (tx) => {
          const updatedConversation = await tx.conversation.update({
            where: { id: request.params.id },
            data: { transcript: request.body.transcript }
          });

          await tx.conversationLog.create({
            data: {
              conversationId: updatedConversation.id,
              role: 'user',
              type: ConversationLogType.TRANSCRIPT,
              content: request.body.transcript
            }
          });

          return updatedConversation;
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

        return reply.send(conversation);
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
    '/api/conversation/:id/logs',
    {
      schema: {
        params: z.object({ id: z.string() }),
        querystring: z.object({
          type: z.nativeEnum(ConversationLogType).optional()
        }),
        response: {
          200: z.object({
            logs: z.array(
              z.object({
                id: z.string(),
                conversationId: z.string(),
                role: z.string(),
                type: z.nativeEnum(ConversationLogType),
                content: z.string(),
                context: z.unknown().nullable(),
                createdAt: z.string()
              })
            )
          })
        }
      }
    },
    async (request, reply) => {
      try {
        const conversation = await updateConversationTranscript(
          prisma,
          request.params.id,
          request.body.transcript
        );

        return reply.send(conversation);
      } catch (error) {
        if (error instanceof ServiceError && error.code === 'NOT_FOUND') {
          return reply.notFound('Conversation not found');
        }

        throw error;
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
        const conversation = await getConversation(prisma, request.params.id);
        return reply.send(conversation);
      } catch (error) {
        if (error instanceof ServiceError && error.code === 'NOT_FOUND') {
          return reply.notFound('Conversation not found');
        }

        throw error;
      }
    }
  );
}
