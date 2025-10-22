import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { env } from './lib/env.js';
import { prisma } from './lib/prisma.js';
import { cacheClient } from './services/cache.js';
import { metricsPlugin } from './plugins/metrics.js';
import { conversationRoutes } from './routes/conversation.js';
import { tokenRoutes } from './routes/token.js';
import { realtimeRoutes } from './routes/realtime.js';
import { scoreRoutes } from './routes/score.js';
import { preferencesRoutes } from './routes/preferences.js';
import { promptRoutes } from './routes/prompts.js';
import { analyticsRoutes } from './routes/analytics.js';
import { authRoutes } from './routes/auth.js';
import { verifyAdminToken } from './services/authService.js';
import type { ErrorResponse } from './routes/error-response.js';

export const buildServer = () => {
  const app = Fastify({
    logger: true
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const configuredOrigins = env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [];
  const fallbackOrigins = env.APP_ENV === 'prod' ? [] : ['*'];
  const origins = configuredOrigins.length > 0 ? configuredOrigins : fallbackOrigins;
  const originConfig = origins.length === 0 ? false : origins.includes('*') ? true : origins;

  if (env.APP_ENV === 'prod' && origins.length === 0) {
    app.log.warn('CORS origin list is empty in production. Set CORS_ORIGIN to enable client access.');
  }

  app.register(cors, { origin: originConfig });
  app.register(sensible);
  app.register(metricsPlugin);

  // Rate limiting - protect against abuse and DoS
  app.register(rateLimit, {
    global: true,
    max: 100, // 100 requests
    timeWindow: '15 minutes',
    errorResponseBuilder: () => ({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
      statusCode: 429
    })
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const isProd = env.APP_ENV === 'prod';
    const code = `ERR_${statusCode}`;
    const rawMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : undefined;
    const sanitizedMessage =
      statusCode >= 500 && isProd
        ? 'Internal server error'
        : rawMessage && rawMessage.trim().length > 0
          ? rawMessage
          : 'Unexpected error';
    const context = isProd
      ? undefined
      : {
          requestId: request.id,
          method: request.method,
          url: request.url,
          statusCode,
          params: request.params,
          query: request.query
        };

    request.log.error(
      {
        code,
        err: error,
        statusCode,
        ...(context ? { context } : {})
      },
      'Unhandled error'
    );

    const response: ErrorResponse = {
      code,
      message: sanitizedMessage,
      ...(context ? { context } : {})
    };

    reply.status(statusCode).send(response);
  });

  app.addHook('onRequest', async (request, reply) => {
    const routePath = request.url.split('?')[0];

    // Skip auth for non-API routes and OPTIONS requests
    if (!routePath.startsWith('/api') || request.method === 'OPTIONS') {
      return;
    }

    // Public endpoints that don't require JWT authentication
    const publicEndpoints = [
      '/api/admin/login',        // Admin login
      '/api/token',              // OpenAI token generation
      '/api/start',              // Start simulation
      '/api/conversations',      // User conversations
      '/api/scores',             // User scores
      '/api/user/preferences'    // User preferences
    ];

    // Check if route is public or starts with /api/realtime
    if (publicEndpoints.includes(routePath) || routePath.startsWith('/api/realtime')) {
      return;
    }

    // Protected admin routes require JWT authentication
    const authorization = request.headers.authorization;
    const bearerToken = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : undefined;

    if (!bearerToken) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    try {
      const payload = verifyAdminToken(bearerToken);
      request.admin = payload;
    } catch (error) {
      request.log.warn({ err: error, route: request.url }, 'Invalid admin token');
      return reply.status(401).send({ message: 'Unauthorized' });
    }
  });

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    await cacheClient.disconnect();
  });

  // Health check endpoint for Docker/K8s orchestration
  app.get('/health', async (request, reply) => {
    try {
      // Check database connectivity
      await prisma.$queryRaw`SELECT 1`;

      return reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env.APP_ENV
      });
    } catch (error) {
      request.log.error({ err: error }, 'Health check failed');
      return reply.status(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        message: 'Service unavailable'
      });
    }
  });

  app.register(authRoutes);
  app.register(conversationRoutes);
  app.register(tokenRoutes);
  app.register(realtimeRoutes);
  app.register(scoreRoutes);
  app.register(preferencesRoutes);
  app.register(promptRoutes);
  app.register(analyticsRoutes);

  return app;
};

export const app = buildServer();

export async function start() {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Server running on http://0.0.0.0:${env.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

// Graceful shutdown handling for K8s/Docker
const signals = ['SIGTERM', 'SIGINT'] as const;
signals.forEach((signal) => {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, starting graceful shutdown...`);

    try {
      await app.close();
      app.log.info('Server closed successfully');
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'Error during shutdown');
      process.exit(1);
    }
  });
});

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
