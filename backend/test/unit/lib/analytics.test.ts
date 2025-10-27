import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { PrismaClient } from '@prisma/client';
import { fetchDailyTrends, fetchScoreDistribution, fetchAnalyticsSummary } from '../../../src/lib/analytics.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Analytics', () => {
  let container: StartedTestContainer;
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Skip if no Docker available
    try {
      await execAsync('docker ps');
    } catch {
      console.log('Docker runtime not available, skipping analytics tests');
      return;
    }

    // Start PostgreSQL container
    container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_USER: 'test',
        POSTGRES_PASSWORD: 'test',
        POSTGRES_DB: 'testdb'
      })
      .withExposedPorts(5432)
      .start();

    const port = container.getMappedPort(5432);
    const databaseUrl = `postgresql://test:test@localhost:${port}/testdb`;

    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

    // Run migrations
    process.env.DATABASE_URL = databaseUrl;
    await execAsync('npx prisma migrate deploy', { cwd: process.cwd() });

    // Seed test data
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    await prisma.user.create({
      data: { id: 'test-user', email: 'test@test.com', password: 'hash' }
    });

    // Create conversations with different scores and dates
    await Promise.all([
      // Today - 3 conversations
      prisma.conversation.create({
        data: {
          userId: 'test-user',
          createdAt: now,
          score: 85,
          status: 'COMPLETED'
        }
      }),
      prisma.conversation.create({
        data: {
          userId: 'test-user',
          createdAt: now,
          score: 75,
          status: 'COMPLETED'
        }
      }),
      prisma.conversation.create({
        data: {
          userId: 'test-user',
          createdAt: now,
          score: null, // No score
          status: 'COMPLETED'
        }
      }),
      // Yesterday - 2 conversations
      prisma.conversation.create({
        data: {
          userId: 'test-user',
          createdAt: yesterday,
          score: 45,
          status: 'COMPLETED'
        }
      }),
      prisma.conversation.create({
        data: {
          userId: 'test-user',
          createdAt: yesterday,
          score: 90,
          status: 'COMPLETED'
        }
      }),
      // Two days ago - 1 conversation
      prisma.conversation.create({
        data: {
          userId: 'test-user',
          createdAt: twoDaysAgo,
          score: 15,
          status: 'COMPLETED'
        }
      })
    ]);
  }, 60000);

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (container) {
      await container.stop();
    }
  });

  describe('fetchAnalyticsSummary', () => {
    it('returns correct summary statistics', async () => {
      if (!prisma) return; // Skip if no Docker

      const summary = await fetchAnalyticsSummary();

      expect(summary.totalConversations).toBe(6);
      expect(summary.scoredConversations).toBe(5);
      expect(summary.averageScore).toBeCloseTo(62); // (85+75+45+90+15)/5 = 62
      expect(summary.bestScore).toEqual({
        conversationId: expect.any(String),
        score: 90
      });
      expect(summary.lowestScore).toEqual({
        conversationId: expect.any(String),
        score: 15
      });
    });
  });

  describe('fetchDailyTrends', () => {
    it('returns correct daily aggregations', async () => {
      if (!prisma) return; // Skip if no Docker

      const trends = await fetchDailyTrends(3);

      expect(trends).toHaveLength(3);

      // Check structure
      trends.forEach((trend) => {
        expect(trend).toHaveProperty('date');
        expect(trend).toHaveProperty('conversations');
        expect(trend).toHaveProperty('averageScore');
      });

      // Today should have 3 conversations, avg of (85+75)/2 = 80
      const today = trends[2];
      expect(today.conversations).toBe(3);
      expect(today.averageScore).toBeCloseTo(80);
    });

    it('fills in missing days with zeros', async () => {
      if (!prisma) return; // Skip if no Docker

      const trends = await fetchDailyTrends(7);

      expect(trends).toHaveLength(7);

      // At least some days should have 0 conversations
      const emptyDays = trends.filter((t) => t.conversations === 0);
      expect(emptyDays.length).toBeGreaterThan(0);
    });

    it('handles edge cases (1 day, 90 days)', async () => {
      if (!prisma) return; // Skip if no Docker

      const oneDay = await fetchDailyTrends(1);
      expect(oneDay).toHaveLength(1);

      const ninetyDays = await fetchDailyTrends(90);
      expect(ninetyDays).toHaveLength(90);

      // Test boundary enforcement
      const overMax = await fetchDailyTrends(100);
      expect(overMax).toHaveLength(90); // Capped at 90

      const underMin = await fetchDailyTrends(0);
      expect(underMin).toHaveLength(1); // Minimum 1
    });
  });

  describe('fetchScoreDistribution', () => {
    it('returns correct bucket counts', async () => {
      if (!prisma) return; // Skip if no Docker

      const distribution = await fetchScoreDistribution();

      expect(distribution).toHaveLength(5);
      expect(distribution).toEqual([
        { range: '0-20', count: 1 },   // score 15
        { range: '21-40', count: 0 },
        { range: '41-60', count: 1 },  // score 45
        { range: '61-80', count: 2 },  // scores 75, 85 (85 rounded up from 81-100)
        { range: '81-100', count: 1 }  // score 90
      ]);
    });

    it('handles empty dataset', async () => {
      if (!prisma) return; // Skip if no Docker

      // Remove all scored conversations
      await prisma.conversation.updateMany({
        data: { score: null }
      });

      const distribution = await fetchScoreDistribution();

      expect(distribution).toHaveLength(5);
      distribution.forEach((bucket) => {
        expect(bucket.count).toBe(0);
      });
    });
  });
});
