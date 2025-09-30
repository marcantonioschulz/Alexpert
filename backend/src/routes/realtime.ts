import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import fetch from 'node-fetch';
import { env } from '../lib/env.js';

export async function realtimeRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/realtime/session',
    {
      schema: {
        body: z.object({
          sdp: z.string(),
          conversationId: z.string(),
          token: z.string().optional()
        }),
        response: {
          200: z.object({ sdp: z.string() }),
          500: z.object({ message: z.string() })
        }
      }
    },
    async (request, reply) => {
      const bearerToken = request.body.token ?? env.OPENAI_API_KEY;

      const response = await fetch(`https://api.openai.com/v1/realtime?model=${env.REALTIME_MODEL}`, {
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
        request.log.error({ errorText }, 'Failed to negotiate WebRTC session');
        return reply.status(500).send({ message: 'Realtime negotiation failed' });
      }

      const answer = await response.text();
      return reply.send({ sdp: answer });
    }
  );
}
