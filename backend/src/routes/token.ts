import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import fetch from 'node-fetch';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { env } from '../lib/env.js';
import { getUserPreferences, resolveOpenAIKey } from '../lib/preferences.js';
import { errorResponseSchema, sendErrorResponse } from './error-response.js';

const sessionResponseSchema = z.object({
  token: z.string(),
  expires_in: z.number()
});

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
      try {
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

        if (!response.ok) {
          const errorText = await response.text();
          request.log.error({ err: errorText, route: 'token:create', status: response.status });
          return sendErrorResponse(reply, 500, 'token.create_failed', 'Failed to create realtime token');
        }

        const payload = sessionResponseSchema.parse(await response.json());
        return reply.send(payload);
      } catch (error) {
        request.log.error({ err: error, route: 'token:create' });
        const message =
          error instanceof Error ? error.message : 'Failed to create realtime token';
        return sendErrorResponse(reply, 500, 'token.create_failed', message);
      }
    }
  );
}
