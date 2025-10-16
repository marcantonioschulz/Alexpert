import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import fetch from 'node-fetch';
import { env } from '../lib/env.js';
import { getUserPreferences, resolveOpenAIKey } from '../lib/preferences.js';
import { errorResponseSchema, sendErrorResponse } from './error-response.js';

export async function realtimeRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/realtime/session',
    {
      schema: {
        body: z.object({
          sdp: z.string(),
          conversationId: z.string(),
          token: z.string().optional(),
          model: z.string().optional(),
          userId: z.string().optional()
        }),
        response: {
          200: z.object({ sdp: z.string() }),
          500: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const userId = request.body.userId ?? 'demo-user';
        const preferences = await getUserPreferences(userId);
        const model = request.body.model ?? preferences.realtimeModel ?? env.REALTIME_MODEL;
        const bearerToken = request.body.token ?? resolveOpenAIKey(preferences);

        const response = await fetch(`https://api.openai.com/v1/realtime?model=${model}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            'Content-Type': 'application/sdp',
            'OpenAI-Beta': 'realtime=v1'
          },
          body: request.body.sdp
        });

        if (!response.ok) {
          const errorText = await response.text();
          request.log.error({ err: errorText, route: 'realtime:session', status: response.status });
          return sendErrorResponse(reply, 500, 'realtime.session_failed', 'Realtime negotiation failed');
        }

        const answer = await response.text();
        return reply.send({ sdp: answer });
      } catch (err) {
        request.log.error({ err, route: 'realtime:session' });
        const message = err instanceof Error ? err.message : 'Realtime negotiation failed';
        return sendErrorResponse(reply, 500, 'realtime.session_failed', message);
      }
    }
  );
}
