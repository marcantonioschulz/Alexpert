import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import supertest from 'supertest';
import type { FastifyInstance } from 'fastify';

describe('metrics endpoint authentication', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    vi.stubEnv('API_KEY', 'test-api-key');
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/test');
    vi.stubEnv('JWT_SECRET', 'test-jwt-secret');
    vi.stubEnv('REALTIME_MODEL', 'test-realtime');
    vi.stubEnv('RESPONSES_MODEL', 'test-responses');

    const { buildServer } = await import('../../src/server.js');
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects requests without admin token', async () => {
    await supertest(app.server).get('/metrics').expect(401);
  });

  it('allows access with a valid admin token', async () => {
    const response = await supertest(app.server)
      .get('/metrics')
      .set('x-api-key', 'test-api-key')
      .expect(200);

    expect(response.text).toBeTypeOf('string');
    expect(response.text.length).toBeGreaterThan(0);
  });
});
