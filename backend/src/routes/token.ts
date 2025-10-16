import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import fetch from 'node-fetch';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { env } from '../lib/env.js';
import { ServiceError } from '../services/errors.js';
import { createEphemeralToken } from '../services/tokenService.js';

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
        const result = await createEphemeralToken(
          {
            fetch: fetch as unknown as typeof globalThis.fetch,
            env: {
              OPENAI_API_KEY: env.OPENAI_API_KEY,
              REALTIME_MODEL: env.REALTIME_MODEL
            }
          },
          request.body ?? {}
        );

        return reply.send({
          token: result.token,
          expires_in: result.expiresIn
        });
      } catch (error) {
        if (error instanceof ServiceError) {
          request.log.error(error, 'Failed to create ephemeral token');
          return reply.status(500).send({ message: error.message });
        }

        throw error;
      }
    }
  );
}
