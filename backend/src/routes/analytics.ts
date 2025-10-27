import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  getAnalyticsSummary,
  getScoreDistribution,
  getScoreTrends
} from '../services/analyticsService.js';
import { sendErrorResponse } from './error-response.js';
import { optionalClerkAuth } from '../middleware/clerk-auth.js';

const summaryDataSchema = z.object({
  totalConversations: z.number(),
  scoredConversations: z.number(),
  averageScore: z.number().nullable(),
  lastConversationAt: z.string().nullable(),
  lastSevenDays: z.number(),
  bestScore: z
    .object({
      conversationId: z.string(),
      score: z.number()
    })
    .nullable(),
  lowestScore: z
    .object({
      conversationId: z.string(),
      score: z.number()
    })
    .nullable()
});

const trendPointSchema = z.object({
  date: z.string(),
  conversations: z.number(),
  averageScore: z.number().nullable()
});

const distributionPointSchema = z.object({
  range: z.string(),
  count: z.number()
});

const baseResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    timestamp: z.string()
  });

const summaryResponseSchema = baseResponseSchema(summaryDataSchema);
const trendsResponseSchema = baseResponseSchema(z.array(trendPointSchema));
const distributionResponseSchema = baseResponseSchema(z.array(distributionPointSchema));

function buildSuccessResponse<T>(data: T) {
  return {
    success: true as const,
    data,
    timestamp: new Date().toISOString()
  };
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/analytics/summary',
    {
      preHandler: [optionalClerkAuth],
      schema: {
        response: {
          200: summaryResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        request.log.info({ authenticated: !!request.user }, 'Fetching analytics summary');
        const summary = await getAnalyticsSummary();
        return reply.send(buildSuccessResponse(summary));
      } catch (error) {
        request.log.error({ err: error }, 'Failed to fetch analytics summary');
        return sendErrorResponse(reply, 500, 'ANALYTICS_SUMMARY_ERROR', 'Failed to fetch analytics summary');
      }
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/analytics/trends',
    {
      preHandler: [optionalClerkAuth],
      schema: {
        querystring: z
          .object({
            days: z.coerce.number().min(1).max(90).optional()
          })
          .optional(),
        response: {
          200: trendsResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const days = request.query?.days ?? 14;
        request.log.info({ days, authenticated: !!request.user }, 'Fetching analytics trends');
        const trend = await getScoreTrends(days);
        return reply.send(buildSuccessResponse(trend));
      } catch (error) {
        request.log.error({ err: error }, 'Failed to fetch analytics trends');
        return sendErrorResponse(reply, 500, 'ANALYTICS_TRENDS_ERROR', 'Failed to fetch analytics trends');
      }
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/analytics/score-distribution',
    {
      preHandler: [optionalClerkAuth],
      schema: {
        response: {
          200: distributionResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        request.log.info({ authenticated: !!request.user }, 'Fetching score distribution');
        const distribution = await getScoreDistribution();
        return reply.send(buildSuccessResponse(distribution));
      } catch (error) {
        request.log.error({ err: error }, 'Failed to fetch score distribution');
        return sendErrorResponse(reply, 500, 'ANALYTICS_DISTRIBUTION_ERROR', 'Failed to fetch score distribution');
      }
    }
  );
}
