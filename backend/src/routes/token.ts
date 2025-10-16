import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import fetch from 'node-fetch';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getUserPreferences, resolveOpenAIKey } from '../lib/preferences.js';

export async function tokenRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/token',
    {
      schema: {
        body: z
          .object({
            model: z.string().optional(),
            userId: z.string().optional()
          })
          .optional(),
        response: {
          200: z.object({
            token: z.string(),
            expires_in: z.number()
          }),
          500: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const userId = request.body?.userId ?? 'demo-user';
      const preferences = await getUserPreferences(userId);
      const model = request.body?.model ?? preferences.realtimeModel ?? env.REALTIME_MODEL;
      const apiKey = resolveOpenAIKey(preferences);

      const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'realtime=v1'
        },
        body: JSON.stringify({ model })
      });

        throw error;
      }
    }
  );
}
