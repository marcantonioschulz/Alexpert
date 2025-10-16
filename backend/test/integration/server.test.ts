import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import supertest from 'supertest';
import type { SuperTest, Test } from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { FastifyInstance } from 'fastify';
import { getContainerRuntimeClient } from 'testcontainers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let runtimeAvailable = true;
try {
  await getContainerRuntimeClient();
} catch (error) {
  runtimeAvailable = false;
  console.warn('Docker runtime not available, skipping integration tests.', error);
}

const describeIfRuntime = runtimeAvailable ? describe : describe.skip;

vi.mock('node-fetch', () => ({
  __esModule: true,
  default: vi.fn(async () => ({
    ok: true,
    json: async () => ({
      output: [
        {
          content: [
            {
              text: '{"score": 92, "feedback": "Great job"}'
            }
          ]
        }
      ]
    }),
    text: async () => 'ok'
  }))
}));

describeIfRuntime('sales simulation API', () => {
  const backendRoot = path.resolve(__dirname, '../../');
  let container: StartedPostgreSqlContainer;
  let app: FastifyInstance;
  let request: SuperTest<Test>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16')
      .withDatabase('testdb')
      .withUsername('test')
      .withPassword('test')
      .start();

    process.env.DATABASE_URL = container.getConnectionUri();
    process.env.API_KEY = 'integration-key';
    process.env.OPENAI_API_KEY = 'integration-openai';
    process.env.REALTIME_MODEL = 'test-realtime';
    process.env.RESPONSES_MODEL = 'test-responses';
    process.env.APP_ENV = 'dev';
    process.env.PORT = '0';

    execFileSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['prisma', 'migrate', 'deploy'],
      {
        cwd: backendRoot,
        env: { ...process.env },
        stdio: 'inherit'
      }
    );

    const { buildServer } = await import('../../src/server.js');
    app = buildServer();
    await app.ready();
    request = supertest(app.server);
  }, 60000);

  it('creates a conversation and persists transcript and score', async () => {
    const startResponse = await request
      .post('/api/start')
      .set('x-api-key', 'integration-key')
      .expect(200);

    const conversationId = startResponse.body.conversationId;
    expect(conversationId).toBeTruthy();

    await request
      .post(`/api/conversation/${conversationId}/transcript`)
      .set('x-api-key', 'integration-key')
      .send({ transcript: 'Hello there' })
      .expect(200);

    const scoreResponse = await request
      .post('/api/score')
      .set('x-api-key', 'integration-key')
      .send({ conversationId })
      .expect(200);

    expect(scoreResponse.body).toMatchObject({
      conversationId,
      score: 92,
      feedback: 'Great job'
    });

    const fetchResponse = await request
      .get(`/api/conversation/${conversationId}`)
      .set('x-api-key', 'integration-key')
      .expect(200);

    expect(fetchResponse.body).toMatchObject({
      id: conversationId,
      transcript: 'Hello there',
      score: 92,
      feedback: 'Great job'
    });
  });

  afterAll(async () => {
    await app.close();
    await container.stop();
  });
});
