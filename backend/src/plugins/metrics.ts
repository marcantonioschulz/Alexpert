import type { FastifyInstance, FastifyRequest } from 'fastify';
import fastifyMetrics from 'fastify-metrics';
import { register } from 'prom-client';
import { requestDurationHistogram, requestErrorCounter } from '../lib/metrics.js';
import { env } from '../lib/env.js';

declare module 'fastify' {
  interface FastifyRequest {
    metricsStartTime?: [number, number];
  }
}

const getRoute = (request: FastifyRequest) => {
  return request.routeOptions?.url ?? request.routerPath ?? request.raw.url ?? 'unknown';
};

export async function metricsPlugin(app: FastifyInstance) {
  // Register metrics plugin without endpoint
  await app.register(fastifyMetrics, {
    endpoint: null,
    defaultMetrics: {
      enabled: true,
      prefix: 'sales_simulation_'
    }
  });

  // Register protected metrics endpoint
  app.get('/metrics', {
    preHandler: async (request, reply) => {
      // If API_KEY is configured, require authentication
      if (env.API_KEY) {
        const apiKey = request.headers['x-api-key'];
        if (!apiKey || apiKey !== env.API_KEY) {
          reply.code(401).send({ error: 'Unauthorized' });
          return;
        }
      }
    }
  }, async (request, reply) => {
    const metrics = await register.metrics();
    reply.type(register.contentType).send(metrics);
  });

  app.addHook('onRequest', async (request) => {
    request.metricsStartTime = process.hrtime();
  });

  app.addHook('onResponse', async (request, reply) => {
    if (!request.metricsStartTime) {
      return;
    }

    const diff = process.hrtime(request.metricsStartTime);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const route = getRoute(request);

    requestDurationHistogram.observe(
      { method: request.method, route, status_code: reply.statusCode.toString() },
      durationSeconds
    );

    if (reply.statusCode >= 500) {
      requestErrorCounter.inc({ method: request.method, route });
    }
  });
}
