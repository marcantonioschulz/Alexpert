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

const fetchMock = vi.fn();

vi.mock('node-fetch', () => ({
  __esModule: true,
  default: fetchMock
}));

describeIfRuntime('sales simulation API', () => {
  const backendRoot = path.resolve(__dirname, '../../');
  let container: StartedPostgreSqlContainer;
  let app: FastifyInstance;
  let request: SuperTest<Test>;

  beforeAll(async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/realtime')) {
        return {
          ok: true,
          status: 200,
          text: async () => 'v=0\no=- 0 0 IN IP4 127.0.0.1',
          json: async () => ({})
        };
      }

      if (typeof url === 'string' && url.includes('/responses')) {
        return {
          ok: true,
          status: 200,
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
          text: async () =>
            JSON.stringify({
              output: [
                {
                  content: [
                    {
                      text: '{"score": 92, "feedback": "Great job"}'
                    }
                  ]
                }
              ]
            })
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => ''
      };
    });

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

  it('creates a conversation, negotiates realtime session and persists transcript and score', async () => {
    const startResponse = await request
      .post('/api/start')
      .set('x-api-key', 'integration-key')
      .expect(200);

    const conversationId = startResponse.body.conversationId;
    expect(conversationId).toBeTruthy();

    await request
      .post('/api/realtime/session')
      .set('x-api-key', 'integration-key')
      .send({
        sdp: 'v=0',
        conversationId,
        token: 'integration-openai'
      })
      .expect(200);

    const finalizeResponse = await request
      .post(`/api/realtime/${conversationId}/finalize`)
      .set('x-api-key', 'integration-key')
      .send({ transcript: 'Hello there' })
      .expect(200);

    expect(finalizeResponse.body).toMatchObject({
      conversationId,
      transcript: 'Hello there',
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

    const promptsResponse = await request
      .get('/api/admin/prompts')
      .set('x-api-key', 'integration-key')
      .expect(200);

    expect(Array.isArray(promptsResponse.body.prompts)).toBe(true);
  });

  afterAll(async () => {
    await app.close();
    await container.stop();
  });
});
