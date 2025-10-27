import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ServiceError } from '../services/errors.js';
import { errorResponseSchema, sendErrorResponse } from './error-response.js';
import { evaluateAndPersistConversation } from '../services/evaluationService.js';
import {
  createConversation,
  persistConversationTranscript
} from '../services/conversationService.js';
import { optionalClerkAuth } from '../middleware/clerk-auth.js';

export async function scoreRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/score',
    {
      preHandler: [optionalClerkAuth],
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
        // Use authenticated user ID if available, otherwise fallback to body or demo-user
        const userId = request.user?.id || request.body.userId || 'demo-user';

        if (!conversationId && !transcriptFromBody) {
          throw new ServiceError(
            'BAD_REQUEST',
            'conversationId oder transcript erforderlich'
          );
        }

        if (conversationId) {
          const existingConversation = await prisma.conversation.findUnique({
            where: { id: conversationId }
          });

          if (!existingConversation) {
            throw new ServiceError('NOT_FOUND', 'Conversation not found');
          }

          const transcript = transcriptFromBody?.trim().length
            ? transcriptFromBody
            : existingConversation.transcript ?? '';

          if (!transcript) {
            throw new ServiceError('BAD_REQUEST', 'Kein Transkript vorhanden');
          }

          if (transcriptFromBody?.trim().length) {
            await persistConversationTranscript(prisma, conversationId, transcriptFromBody);
          }

          const { evaluation } = await evaluateAndPersistConversation({
            prisma,
            conversationId,
            transcript,
            userId: existingConversation.userId ?? userId,
            logger: request.log
          });

          return reply.send({
            conversationId,
            score: evaluation.score,
            feedback: evaluation.feedback
          });
        }

        const transcript = transcriptFromBody ?? '';

        if (!transcript.trim().length) {
          throw new ServiceError('BAD_REQUEST', 'Kein Transkript vorhanden');
        }

        // TODO: This is a legacy endpoint - update to use Clerk auth
        // For now, use demo organization ID
        const DEMO_ORG_ID = 'demo-org';
        const newConversation = await createConversation(prisma, userId, DEMO_ORG_ID);

        await persistConversationTranscript(prisma, newConversation.id, transcript);

        const { evaluation } = await evaluateAndPersistConversation({
          prisma,
          conversationId: newConversation.id,
          transcript,
          userId,
          logger: request.log
        });

        return reply.send({
          conversationId: newConversation.id,
          score: evaluation.score,
          feedback: evaluation.feedback
        });
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
