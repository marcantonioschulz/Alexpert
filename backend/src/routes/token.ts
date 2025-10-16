import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import fetch from 'node-fetch';
import { env } from '../lib/env.js';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { errorResponseSchema, sendErrorResponse } from './error-response.js';

export async function tokenRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/token',
    {
      schema: {
        body: z
          .object({
            model: z.string().optional()
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
        const model = request.body?.model ?? env.REALTIME_MODEL;

        const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'realtime=v1'
          },
          body: JSON.stringify({ model })
        });

        if (!response.ok) {
          const errorText = await response.text();
          request.log.error({ err: errorText, route: 'token:create', status: response.status });
          return sendErrorResponse(
            reply,
            500,
            'token.create_failed',
            'Failed to create ephemeral token'
          );
        }

        const payload = (await response.json()) as {
          client_secret: {
            value: string;
            expires_at: number;
          };
        };

        const expiresIn = Math.max(0, Math.floor(payload.client_secret.expires_at - Date.now() / 1000));

        return reply.send({
          token: payload.client_secret.value,
          expires_in: expiresIn
        });
      } catch (err) {
        request.log.error({ err, route: 'token:create' });
        const message = err instanceof Error ? err.message : 'Failed to create ephemeral token';
        return sendErrorResponse(reply, 500, 'token.create_failed', message);
      }
    }
  );
}
