import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { verifyClerkAuth } from '../middleware/clerk-auth.js';
import { resolveOrganization } from '../middleware/organization.js';
import { checkQuota } from '../services/quota.js';
import { getOrganizationByClerkId } from '../services/clerkSync.js';
import { errorResponseSchema, sendErrorResponse } from './error-response.js';

/**
 * Organization management routes
 */
export async function organizationRoutes(app: FastifyInstance) {
  /**
   * Get organization details
   */
  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/organizations/:clerkOrgId',
    {
      preHandler: [verifyClerkAuth],
      schema: {
        params: z.object({
          clerkOrgId: z.string()
        }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            slug: z.string(),
            plan: z.enum(['FREE', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE']),
            monthlyQuota: z.number(),
            currentUsage: z.number(),
            logo: z.string().nullable()
          }),
          404: errorResponseSchema,
          500: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const organization = await getOrganizationByClerkId(request.params.clerkOrgId);

        if (!organization) {
          return sendErrorResponse(
            reply,
            404,
            'org.not_found',
            'Organization not found'
          );
        }

        return reply.send({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          plan: organization.plan,
          monthlyQuota: organization.monthlyQuota,
          currentUsage: organization.currentUsage,
          logo: organization.logo
        });
      } catch (err) {
        request.log.error({ err, route: 'organizations:get' });
        return sendErrorResponse(
          reply,
          500,
          'org.fetch_failed',
          'Failed to fetch organization'
        );
      }
    }
  );

  /**
   * Get organization quota status
   */
  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/organizations/:clerkOrgId/quota',
    {
      preHandler: [verifyClerkAuth],
      schema: {
        params: z.object({
          clerkOrgId: z.string()
        }),
        response: {
          200: z.object({
            current: z.number(),
            limit: z.number(),
            remaining: z.number(),
            resetDate: z.string(),
            isUnlimited: z.boolean(),
            canProceed: z.boolean()
          }),
          404: errorResponseSchema,
          500: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const organization = await getOrganizationByClerkId(request.params.clerkOrgId);

        if (!organization) {
          return sendErrorResponse(
            reply,
            404,
            'org.not_found',
            'Organization not found'
          );
        }

        const quotaStatus = await checkQuota(organization.id);

        return reply.send({
          current: quotaStatus.current,
          limit: quotaStatus.limit,
          remaining: quotaStatus.remaining,
          resetDate: quotaStatus.resetDate.toISOString(),
          isUnlimited: quotaStatus.isUnlimited,
          canProceed: quotaStatus.canProceed
        });
      } catch (err) {
        request.log.error({ err, route: 'organizations:getQuota' });
        return sendErrorResponse(
          reply,
          500,
          'org.quota_fetch_failed',
          'Failed to fetch quota status'
        );
      }
    }
  );

  /**
   * List user's conversations (organization-filtered)
   */
  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/conversations',
    {
      preHandler: [verifyClerkAuth, resolveOrganization],
      schema: {
        querystring: z.object({
          limit: z.coerce.number().min(1).max(100).default(20),
          offset: z.coerce.number().min(0).default(0)
        }),
        response: {
          200: z.object({
            conversations: z.array(
              z.object({
                id: z.string(),
                transcript: z.string().nullable(),
                score: z.number().nullable(),
                feedback: z.string().nullable(),
                createdAt: z.string()
              })
            ),
            total: z.number(),
            limit: z.number(),
            offset: z.number()
          }),
          401: errorResponseSchema,
          500: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        if (!request.user || !request.organization) {
          return sendErrorResponse(reply, 401, 'auth.required', 'Authentication required');
        }

        const [conversations, total] = await Promise.all([
          request.server.prisma.conversation.findMany({
            where: {
              userId: request.user.id,
              organizationId: request.organization.id
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: request.query.limit,
            skip: request.query.offset
          }),
          request.server.prisma.conversation.count({
            where: {
              userId: request.user.id,
              organizationId: request.organization.id
            }
          })
        ]);

        return reply.send({
          conversations: conversations.map((conv) => ({
            id: conv.id,
            transcript: conv.transcript,
            score: conv.score,
            feedback: conv.feedback,
            createdAt: conv.createdAt.toISOString()
          })),
          total,
          limit: request.query.limit,
          offset: request.query.offset
        });
      } catch (err) {
        request.log.error({ err, route: 'conversations:list' });
        return sendErrorResponse(
          reply,
          500,
          'conversations.list_failed',
          'Failed to list conversations'
        );
      }
    }
  );
}
