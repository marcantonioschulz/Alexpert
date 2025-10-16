import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import cors from '@fastify/cors';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { env } from './lib/env.js';
import { prisma } from './lib/prisma.js';
import { conversationRoutes } from './routes/conversation.js';
import { tokenRoutes } from './routes/token.js';
import { realtimeRoutes } from './routes/realtime.js';
import { scoreRoutes } from './routes/score.js';
import { preferencesRoutes } from './routes/preferences.js';

const buildServer = () => {
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

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error, 'Unhandled error');

    const statusCode = error.statusCode ?? 500;
    const isProd = env.APP_ENV === 'prod';
    const showOriginalMessage = statusCode < 500 || !isProd;
    const message = showOriginalMessage ? error.message : 'Internal server error';

    const response: Record<string, unknown> = {
      error: message
    };

    if (!isProd && error.stack) {
      response.stack = error.stack;
    }

    reply.status(statusCode).send(response);
  });

  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api')) {
      return;
    }

    const apiKey = request.headers['x-api-key'];
    if (apiKey !== env.API_KEY) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
  });

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  app.register(conversationRoutes);
  app.register(tokenRoutes);
  app.register(realtimeRoutes);
  app.register(scoreRoutes);
  app.register(preferencesRoutes);

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

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
