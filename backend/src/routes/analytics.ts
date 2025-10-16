import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  fetchAnalyticsSummary,
  fetchDailyTrends,
  fetchScoreDistribution
} from '../lib/analytics.js';

const summarySchema = z.object({
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

const trendSchema = z.array(
  z.object({
    date: z.string(),
    conversations: z.number(),
    averageScore: z.number().nullable()
  })
);

const distributionSchema = z.array(
  z.object({
    range: z.string(),
    count: z.number()
  })
);

export async function analyticsRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/analytics/summary',
    {
      schema: {
        response: {
          200: summarySchema
        }
      }
    },
    async (_request, reply) => {
      const summary = await fetchAnalyticsSummary();
      return reply.send(summary);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/analytics/trends',
    {
      schema: {
        querystring: z
          .object({
            days: z.coerce.number().min(1).max(90).optional()
          })
          .optional(),
        response: {
          200: trendSchema
        }
      }
    },
    async (request, reply) => {
      const days = request.query?.days ?? 14;
      const trend = await fetchDailyTrends(days);
      return reply.send(trend);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/analytics/score-distribution',
    {
      schema: {
        response: {
          200: distributionSchema
        }
      }
    },
    async (_request, reply) => {
      const distribution = await fetchScoreDistribution();
      return reply.send(distribution);
    }
  );
}
