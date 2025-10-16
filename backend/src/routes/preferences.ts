import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getUserPreferences, saveUserPreferences } from '../lib/preferences.js';

const themeEnum = z.enum(['light', 'dark', 'system']);

export async function preferencesRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/preferences',
    {
      schema: {
        querystring: z.object({
          userId: z.string().optional()
        }),
        response: {
          200: z.object({
            userId: z.string(),
            realtimeModel: z.string(),
            responsesModel: z.string(),
            apiKeyOverride: z.string().nullable(),
            theme: themeEnum
          })
        }
      }
    },
    async (request, reply) => {
      const userId = request.query.userId ?? 'demo-user';
      const preferences = await getUserPreferences(userId);

      return reply.send(preferences);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/preferences',
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
          200: z.object({
            userId: z.string(),
            realtimeModel: z.string(),
            responsesModel: z.string(),
            apiKeyOverride: z.string().nullable(),
            theme: themeEnum
          })
        }
      }
    },
    async (request, reply) => {
      const { userId, ...payload } = request.body;
      const preferences = await saveUserPreferences(userId, payload);

      return reply.send(preferences);
    }
  );
}
