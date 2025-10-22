import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticateAdmin, generateAdminToken } from '../services/authService.js';
import { errorResponseSchema, sendErrorResponse, type ErrorResponse } from './error-response.js';

export async function authRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/admin/login',
    {
      schema: {
        body: z.object({
          email: z.string().email(),
          password: z.string().min(8)
        }),
        response: {
          200: z.object({ token: z.string() }),
          401: errorResponseSchema satisfies z.ZodType<ErrorResponse>
        }
      },
      config: {
        rateLimit: {
          max: 5, // Only 5 login attempts
          timeWindow: '15 minutes' // per 15 minutes
        }
      }
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const admin = await authenticateAdmin(email, password);
      if (!admin) {
        return sendErrorResponse(reply, 401, 'auth.invalid_credentials', 'Invalid credentials');
      }

      const token = generateAdminToken(admin);
      return reply.send({ token });
    }
  );
}
