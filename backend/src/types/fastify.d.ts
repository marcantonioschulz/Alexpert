import type { AdminJwtPayload } from '../services/authService.js';

declare module 'fastify' {
  interface FastifyRequest {
    admin?: AdminJwtPayload;
  }
}
