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

const adminCredentials = {
  email: 'admin@example.com',
  password: 'StrongPass!123'
};

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
    process.env.OPENAI_API_KEY = 'integration-openai';
    process.env.REALTIME_MODEL = 'test-realtime';
    process.env.RESPONSES_MODEL = 'test-responses';
    process.env.APP_ENV = 'dev';
    process.env.PORT = '0';
    process.env.API_KEY = 'integration-api-key-1234567890';
    process.env.JWT_SECRET = 'integration-jwt-secret-12345678901234567890';

    execFileSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['prisma', 'migrate', 'deploy'],
      {
        cwd: backendRoot,
        env: { ...process.env },
        stdio: 'inherit'
      }
    );

    const { prisma } = await import('../../src/lib/prisma.js');
    const { hashPassword } = await import('../../src/services/authService.js');

    await prisma.adminUser.create({
      data: {
        email: adminCredentials.email,
        passwordHash: await hashPassword(adminCredentials.password),
        role: 'admin'
      }
    });

    const { buildServer } = await import('../../src/server.js');
    app = buildServer();
    await app.ready();
    request = supertest(app.server);
  }, 60000);

  it('public endpoints work without auth, admin endpoints require auth', async () => {
    // Public endpoint: /api/start should work without auth
    const startResponse = await request.post('/api/start').expect(200);

    const conversationId = startResponse.body.conversationId;
    expect(conversationId).toBeTruthy();

    // Public endpoint: /api/realtime/* should work without auth
    await request
      .post('/api/realtime/session')
      .send({
        sdp: 'v=0',
        conversationId,
        token: 'integration-openai'
      })
      .expect(200);

    // Public endpoint: /api/realtime/{id}/finalize should work without auth
    const finalizeResponse = await request
      .post(`/api/realtime/${conversationId}/finalize`)
      .send({ transcript: 'Hello there' })
      .expect(200);

    expect(finalizeResponse.body).toMatchObject({
      conversationId,
      transcript: 'Hello there',
      score: 92,
      feedback: 'Great job'
    });

    // Public endpoint: /api/conversation/{id} should work without auth
    const fetchResponse = await request
      .get(`/api/conversation/${conversationId}`)
      .expect(200);

    expect(fetchResponse.body).toMatchObject({
      id: conversationId,
      transcript: 'Hello there',
      score: 92,
      feedback: 'Great job'
    });

    // Protected endpoint: /api/admin/prompts should require auth
    await request.get('/api/admin/prompts').expect(401);

    // Protected endpoint: /api/analytics/summary should require auth
    await request.get('/api/analytics/summary').expect(401);

    // Login to get admin token
    const loginResponse = await request
      .post('/api/admin/login')
      .send(adminCredentials)
      .expect(200);

    const token = loginResponse.body.token as string;
    expect(token).toBeTruthy();
    const authHeader = `Bearer ${token}`;

    // Protected endpoint: /api/admin/prompts should work with auth
    const promptsResponse = await request
      .get('/api/admin/prompts')
      .set('Authorization', authHeader)
      .expect(200);

    expect(Array.isArray(promptsResponse.body.prompts)).toBe(true);

    // Protected endpoint: /api/analytics/summary should work with auth
    const summaryResponse = await request
      .get('/api/analytics/summary')
      .set('Authorization', authHeader)
      .expect(200);

    expect(summaryResponse.body).toMatchObject({
      success: true,
      data: {
        totalConversations: 1,
        scoredConversations: 1,
        averageScore: 92,
        lastSevenDays: 1,
        bestScore: { score: 92 },
        lowestScore: { score: 92 }
      }
    });

    const trendsResponse = await request
      .get('/api/analytics/trends?days=5')
      .set('Authorization', authHeader)
      .expect(200);

    expect(trendsResponse.body.success).toBe(true);
    expect(Array.isArray(trendsResponse.body.data)).toBe(true);
    expect(trendsResponse.body.data.length).toBe(5);

    const distributionResponse = await request
      .get('/api/analytics/score-distribution')
      .set('Authorization', authHeader)
      .expect(200);

    expect(distributionResponse.body.success).toBe(true);
    expect(
      distributionResponse.body.data.some(
        (bucket: { range: string; count: number }) => bucket.range === '81-100' && bucket.count === 1
      )
    ).toBe(true);

    const preferencesResponse = await request
      .get('/api/user/preferences?userId=integration-user')
      .set('Authorization', authHeader)
      .expect(200);

    expect(preferencesResponse.body).toMatchObject({
      success: true,
      data: {
        userId: 'integration-user',
        realtimeModel: 'test-realtime',
        responsesModel: 'test-responses',
        theme: 'system'
      }
    });

    const savePreferencesResponse = await request
      .post('/api/user/preferences')
      .set('Authorization', authHeader)
      .send({
        userId: 'integration-user',
        realtimeModel: 'updated-realtime',
        responsesModel: 'updated-responses',
        apiKeyOverride: null,
        theme: 'dark'
      })
      .expect(200);

    expect(savePreferencesResponse.body).toMatchObject({
      success: true,
      data: {
        userId: 'integration-user',
        realtimeModel: 'updated-realtime',
        responsesModel: 'updated-responses',
        theme: 'dark'
      }
    });
  });

  afterAll(async () => {
    await app.close();
    await container.stop();
  });
});
