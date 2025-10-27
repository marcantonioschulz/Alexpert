import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  PromptKey,
  ensurePromptValue,
  listPromptSettings,
  setPromptValue
} from '../services/promptService.js';
import { ServiceError } from '../services/errors.js';
import { errorResponseSchema, sendErrorResponse } from './error-response.js';
import { optionalClerkAuth } from '../middleware/clerk-auth.js';

export async function promptRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/admin/prompts',
    {
      preHandler: [optionalClerkAuth],
      schema: {
        response: {
          200: z.object({
            prompts: z.array(
              z.object({
                key: z.nativeEnum(PromptKey),
                value: z.string(),
                description: z.string().nullable(),
                createdAt: z.string(),
                updatedAt: z.string()
              })
            )
          }),
          500: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        await Promise.all(
          Object.values(PromptKey).map((key) => ensurePromptValue(prisma, key as PromptKey))
        );

        const prompts = await listPromptSettings(prisma);
        return reply.send({ prompts });
      } catch (error) {
        request.log.error({ error, route: 'prompts:list' }, 'Failed to list prompts');
        return sendErrorResponse(reply, 500, 'prompts.list_failed', 'Failed to load prompts');
      }
    }
  );

  app.withTypeProvider<ZodTypeProvider>().put(
    '/api/admin/prompts/:key',
    {
      preHandler: [optionalClerkAuth],
      schema: {
        params: z.object({
          key: z.nativeEnum(PromptKey)
        }),
        body: z.object({
          value: z.string().min(1),
          description: z.string().optional()
        }),
        response: {
          200: z.object({
            key: z.nativeEnum(PromptKey),
            value: z.string(),
            description: z.string().nullable(),
            createdAt: z.string(),
            updatedAt: z.string()
          }),
          400: errorResponseSchema,
          500: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const prompt = await setPromptValue(
          prisma,
          request.params.key,
          request.body.value,
          request.body.description
        );

        return reply.send(prompt);
      } catch (error) {
        if (error instanceof ServiceError) {
          if (error.code === 'BAD_REQUEST') {
            return sendErrorResponse(reply, 400, 'prompts.invalid', error.message);
          }

          request.log.error({ error, route: 'prompts:update' }, 'Failed to update prompt');
          return sendErrorResponse(reply, 500, 'prompts.update_failed', error.message);
        }

        request.log.error({ error, route: 'prompts:update' }, 'Failed to update prompt');
        return sendErrorResponse(reply, 500, 'prompts.update_failed', 'Failed to update prompt');
      }
    }
  );
}
