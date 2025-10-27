import { prisma } from './prisma.js';
import type {
  AnalyticsDailyTrend,
  AnalyticsSummary,
  ScoreDistributionBucket
} from '../types/index.js';

const SCORE_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: '0-20', min: 0, max: 20 },
  { label: '21-40', min: 21, max: 40 },
  { label: '41-60', min: 41, max: 60 },
  { label: '61-80', min: 61, max: 80 },
  { label: '81-100', min: 81, max: 100 }
];

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime());
  sevenDaysAgo.setHours(0, 0, 0, 0);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [
    totalConversations,
    scoredConversations,
    averageAggregate,
    mostRecentConversation,
    bestConversation,
    lowestConversation,
    recentConversationCount
  ] = await Promise.all([
    prisma.conversation.count(),
    prisma.conversation.count({ where: { score: { not: null } } }),
    prisma.conversation.aggregate({
      _avg: { score: true },
      where: { score: { not: null } }
    }),
    prisma.conversation.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.conversation.findFirst({
      where: { score: { not: null } },
      orderBy: { score: 'desc' }
    }),
    prisma.conversation.findFirst({
      where: { score: { not: null } },
      orderBy: { score: 'asc' }
    }),
    prisma.conversation.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo
        }
      }
    })
  ]);

  const averageScore = averageAggregate._avg.score;

  return {
    totalConversations,
    scoredConversations,
    averageScore: averageScore !== null && averageScore !== undefined ? Number(averageScore.toFixed(2)) : null,
    lastConversationAt: mostRecentConversation?.createdAt.toISOString() ?? null,
    lastSevenDays: recentConversationCount,
    bestScore: bestConversation?.score
      ? {
          conversationId: bestConversation.id,
          score: bestConversation.score
        }
      : null,
    lowestScore: lowestConversation?.score
      ? {
          conversationId: lowestConversation.id,
          score: lowestConversation.score
        }
      : null
  };
}

export async function fetchDailyTrends(days: number): Promise<AnalyticsDailyTrend[]> {
  const boundedDays = Math.min(Math.max(days, 1), 90);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(today.getTime());
  startDate.setDate(startDate.getDate() - (boundedDays - 1));

  // Use SQL GROUP BY for efficient aggregation at database level
  const aggregatedData = await prisma.$queryRaw<
    Array<{
      date: Date;
      conversations: bigint;
      averageScore: number | null;
    }>
  >`
    SELECT
      DATE_TRUNC('day', "createdAt")::date as date,
      COUNT(*)::bigint as conversations,
      AVG(score) as "averageScore"
    FROM "Conversation"
    WHERE "createdAt" >= ${startDate}
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY date ASC
  `;

  // Create a map of dates that have data
  const dataMap = new Map(
    aggregatedData.map((row) => [
      row.date.toISOString().slice(0, 10),
      {
        date: row.date.toISOString().slice(0, 10),
        conversations: Number(row.conversations),
        averageScore: row.averageScore !== null ? Number(row.averageScore.toFixed(2)) : null
      }
    ])
  );

  // Fill in missing days with zero values
  const result: AnalyticsDailyTrend[] = [];
  for (let i = 0; i < boundedDays; i += 1) {
    const day = new Date(startDate.getTime());
    day.setDate(startDate.getDate() + i);
    const key = day.toISOString().slice(0, 10);

    result.push(
      dataMap.get(key) || {
        date: key,
        conversations: 0,
        averageScore: null
      }
    );
  }

  return result;
}

export async function fetchScoreDistribution(): Promise<ScoreDistributionBucket[]> {
  // Use SQL CASE WHEN for efficient bucketing at database level
  const bucketCounts = await prisma.$queryRaw<
    Array<{
      bucket: string;
      count: bigint;
    }>
  >`
    SELECT
      CASE
        WHEN score >= 0 AND score <= 20 THEN '0-20'
        WHEN score >= 21 AND score <= 40 THEN '21-40'
        WHEN score >= 41 AND score <= 60 THEN '41-60'
        WHEN score >= 61 AND score <= 80 THEN '61-80'
        WHEN score >= 81 AND score <= 100 THEN '81-100'
        ELSE 'unknown'
      END as bucket,
      COUNT(*)::bigint as count
    FROM "Conversation"
    WHERE score IS NOT NULL
    GROUP BY bucket
    ORDER BY bucket
  `;

  // Create a map of bucket counts
  const countMap = new Map(
    bucketCounts
      .filter((row) => row.bucket !== 'unknown')
      .map((row) => [row.bucket, Number(row.count)])
  );

  // Return all buckets with their counts (0 if not in result)
  return SCORE_BUCKETS.map(({ label }) => ({
    range: label,
    count: countMap.get(label) || 0
  }));
}
