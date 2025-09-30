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

const buildServer = () => {
  const app = Fastify({
    logger: true
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, { origin: true });
  app.register(sensible);

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
