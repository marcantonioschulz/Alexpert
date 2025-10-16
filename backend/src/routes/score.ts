import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import fetch from 'node-fetch';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { ServiceError } from '../services/errors.js';
import { scoreConversation } from '../services/scoreService.js';

export async function scoreRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/score',
    {
      schema: {
        body: z.object({
          conversationId: z.string().optional(),
          transcript: z.string().optional()
        }),
        response: {
          200: z.object({
            conversationId: z.string(),
            score: z.number(),
            feedback: z.string()
          }),
          500: z.object({
            message: z.string()
          })
        }
      }
    },
    async (request, reply) => {
      try {
        const result = await scoreConversation(
          {
            prisma,
            fetch: fetch as unknown as typeof globalThis.fetch,
            env: {
              OPENAI_API_KEY: env.OPENAI_API_KEY,
              RESPONSES_MODEL: env.RESPONSES_MODEL
            }
          },
          request.body
        );

        return reply.send(result);
      } catch (error) {
        if (error instanceof ServiceError) {
          switch (error.code) {
            case 'BAD_REQUEST':
              return reply.badRequest(error.message);
            case 'NOT_FOUND':
              return reply.notFound(error.message);
            case 'UPSTREAM_ERROR':
              request.log.error(error, 'Failed to fetch score from OpenAI');
              return reply.status(500).send({ message: error.message });
            default:
              break;
          }
        }

        throw error;
      }
    }
  );
}
