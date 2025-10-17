import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getUserPreferences, saveUserPreferences } from '../lib/preferences.js';
import { sendErrorResponse } from './error-response.js';

const themeEnum = z.enum(['light', 'dark', 'system']);

const preferencesSchema = z.object({
  userId: z.string(),
  realtimeModel: z.string(),
  responsesModel: z.string(),
  apiKeyOverride: z.string().nullable(),
  theme: themeEnum
});

const preferencesResponseSchema = z.object({
  success: z.literal(true),
  data: preferencesSchema,
  timestamp: z.string()
});

export async function preferencesRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/user/preferences',
    {
      schema: {
        querystring: z.object({
          userId: z.string().optional()
        }),
        response: {
          200: preferencesResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const userId = request.query.userId ?? 'demo-user';
        request.log.info({ userId }, 'Fetching user preferences');
        const preferences = await getUserPreferences(userId);
        return reply.send({
          success: true as const,
          data: preferences,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to fetch preferences');
        return sendErrorResponse(reply, 500, 'PREFERENCES_FETCH_ERROR', 'Failed to fetch preferences');
      }
    }
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/user/preferences',
    {
      schema: {
        body: z.object({
          userId: z.string().default('demo-user'),
          realtimeModel: z.string(),
          responsesModel: z.string(),
          apiKeyOverride: z.string().nullable(),
          theme: themeEnum
        }),
        response: {
          200: preferencesResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const { userId, ...payload } = request.body;
        request.log.info({ userId }, 'Saving user preferences');
        const preferences = await saveUserPreferences(userId, payload);
        return reply.send({
          success: true as const,
          data: preferences,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to save preferences');
        return sendErrorResponse(reply, 500, 'PREFERENCES_SAVE_ERROR', 'Failed to save preferences');
      }
    }
  );
}
