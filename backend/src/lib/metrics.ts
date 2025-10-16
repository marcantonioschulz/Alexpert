import { Counter, Histogram, register } from 'prom-client';

const getOrCreateHistogram = (
  name: string,
  help: string,
  labelNames: string[],
  buckets: number[]
) => {
  const existing = register.getSingleMetric(name);
  if (existing) {
    return existing as Histogram<string>;
  }

  return new Histogram({
    name,
    help,
    labelNames,
    buckets
  });
};

const getOrCreateCounter = (name: string, help: string, labelNames: string[]) => {
  const existing = register.getSingleMetric(name);
  if (existing) {
    return existing as Counter<string>;
  }

  return new Counter({
    name,
    help,
    labelNames
  });
};

export const requestDurationHistogram = getOrCreateHistogram(
  'fastify_request_duration_seconds',
  'Latency of handled HTTP requests',
  ['method', 'route', 'status_code'],
  [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10]
);

export const requestErrorCounter = getOrCreateCounter(
  'fastify_request_errors_total',
  'Total number of HTTP 5xx responses',
  ['method', 'route']
);

export const openAIRequestCounter = getOrCreateCounter(
  'openai_requests_total',
  'Total number of OpenAI API requests issued by the backend',
  ['endpoint', 'status']
);

export const openAITokenCounter = getOrCreateCounter(
  'openai_tokens_total',
  'Aggregated count of OpenAI tokens consumed by the backend',
  ['endpoint']
);
