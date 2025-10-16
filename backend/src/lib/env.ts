import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  APP_ENV: z.enum(['dev', 'prod']).default('dev'),
  PORT: z.coerce.number().default(4000),
  API_KEY: z.string(),
  OPENAI_API_KEY: z.string(),
  REALTIME_MODEL: z.string().default('gpt-4o-realtime-preview'),
  RESPONSES_MODEL: z.string().default('gpt-4o-mini'),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().optional(),
  OPENAI_TIMEOUT_MS: z.coerce.number().optional(),
  OPENAI_MAX_RETRIES: z.coerce.number().optional(),
  OPENAI_INITIAL_BACKOFF_MS: z.coerce.number().optional(),
  OPENAI_BACKOFF_MULTIPLIER: z.coerce.number().optional(),
  CACHE_URL: z.string().url().optional(),
  CACHE_TTL_SECONDS: z.coerce.number().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
