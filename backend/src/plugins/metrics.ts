import type { FastifyInstance, FastifyRequest } from 'fastify';
import fastifyMetrics from 'fastify-metrics';
import { requestDurationHistogram, requestErrorCounter } from '../lib/metrics.js';

declare module 'fastify' {
  interface FastifyRequest {
    metricsStartTime?: [number, number];
  }
}

const getRoute = (request: FastifyRequest) => {
  return request.routeOptions?.url ?? request.routerPath ?? request.raw.url ?? 'unknown';
};

export async function metricsPlugin(app: FastifyInstance) {
  app.register(fastifyMetrics, {
    endpoint: '/metrics',
    defaultMetrics: {
      enabled: true,
      prefix: 'sales_simulation_'
    }
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
