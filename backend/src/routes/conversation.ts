import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ServiceError } from '../services/errors.js';
import {
  createConversation,
  getConversation,
  persistConversationTranscript
} from '../services/conversationService.js';
import { ConversationLogType } from '../types/index.js';
import {
  errorResponseSchema,
  sendErrorResponse,
  type ErrorResponse
} from './error-response.js';
import { verifyClerkAuth } from '../middleware/clerk-auth.js';
import { resolveOrganization, checkOrganizationQuota } from '../middleware/organization.js';
import { incrementQuota } from '../services/quota.js';

export async function conversationRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/start',
    {
      preHandler: [verifyClerkAuth, resolveOrganization, checkOrganizationQuota],
      schema: {
        response: {
          200: z.object({ conversationId: z.string() }),
          401: errorResponseSchema,
          403: errorResponseSchema,
          429: errorResponseSchema,
          500: errorResponseSchema satisfies z.ZodType<ErrorResponse>
        }
      }
    },
    async (request, reply) => {
      try {
        // User and organization are attached by middlewares
        if (!request.user || !request.organization) {
          return sendErrorResponse(reply, 401, 'auth.required', 'Authentication required');
        }

        // Create conversation with user and organization context
        const conversation = await createConversation(
          prisma,
          request.user.id,
          request.organization.id
        );

        // Increment quota after successful conversation creation
        try {
          await incrementQuota(request.organization.id, 1);
        } catch (quotaError) {
          request.log.warn(
            { err: quotaError, organizationId: request.organization.id },
            'Failed to increment quota after conversation creation'
          );
          // Continue anyway - conversation is already created
        }

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
        const conversation = await persistConversationTranscript(
          prisma,
          request.params.id,
          request.body.transcript
        );

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
          }),
          500: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const logs = (await prisma.conversationLog.findMany({
          where: {
            conversationId: request.params.id,
            ...(request.query.type ? { type: request.query.type } : {})
          },
          orderBy: { createdAt: 'asc' }
        })) as Array<{
          id: string;
          conversationId: string;
          role: string;
          type: ConversationLogType;
          content: string;
          context: unknown | null;
          createdAt: Date;
        }>;

        return reply.send({
          logs: logs.map((log) => ({
            id: log.id,
            conversationId: log.conversationId,
            role: log.role,
            type: log.type,
            content: log.content,
            context: log.context ?? null,
            createdAt: log.createdAt.toISOString()
          }))
        });
      } catch (err) {
        request.log.error({ err, route: 'conversation:getLogs' });

        const message =
          err instanceof Error ? err.message : 'Failed to fetch conversation logs';

        return sendErrorResponse(reply, 500, 'conversation.logs_fetch_failed', message, {
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
