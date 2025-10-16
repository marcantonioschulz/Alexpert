import type { FastifyReply } from 'fastify';
import { env } from '../lib/env.js';
import { z } from 'zod';

export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  context: z.record(z.any()).optional()
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type ErrorResponseContext = Record<string, unknown> | undefined;

export function sendErrorResponse(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  context?: ErrorResponseContext
) {
  const shouldMaskMessage = env.APP_ENV === 'prod' && statusCode >= 500;
  const payload = {
    code,
    message: shouldMaskMessage ? 'Internal server error' : message,
    ...(context ? { context } : {})
  };

  return reply.status(statusCode).send(payload);
}
