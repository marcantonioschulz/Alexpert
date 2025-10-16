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

  const conversations = await prisma.conversation.findMany({
    where: {
      createdAt: {
        gte: startDate
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const dayMap = new Map<string, { date: string; conversations: number; scoreSum: number; scoredCount: number }>();

  for (let i = 0; i < boundedDays; i += 1) {
    const day = new Date(startDate.getTime());
    day.setDate(startDate.getDate() + i);
    const key = day.toISOString().slice(0, 10);
    dayMap.set(key, {
      date: key,
      conversations: 0,
      scoreSum: 0,
      scoredCount: 0
    });
  }

  conversations.forEach((conversation) => {
    const key = conversation.createdAt.toISOString().slice(0, 10);
    const bucket = dayMap.get(key);

    if (!bucket) {
      return;
    }

    bucket.conversations += 1;

    if (conversation.score !== null && conversation.score !== undefined) {
      bucket.scoreSum += conversation.score;
      bucket.scoredCount += 1;
    }
  });

  return Array.from(dayMap.values()).map(({ scoreSum, scoredCount, ...rest }) => ({
    ...rest,
    averageScore: scoredCount > 0 ? Number((scoreSum / scoredCount).toFixed(2)) : null
  }));
}

export async function fetchScoreDistribution(): Promise<ScoreDistributionBucket[]> {
  const scoredConversations = await prisma.conversation.findMany({
    where: { score: { not: null } },
    select: { score: true }
  });

  const buckets = SCORE_BUCKETS.map((bucket) => ({ ...bucket, count: 0 }));

  scoredConversations.forEach(({ score }) => {
    if (score === null) {
      return;
    }

    const bucket = buckets.find((item) => score >= item.min && score <= item.max);
    if (bucket) {
      bucket.count += 1;
    }
  });

  return buckets.map(({ label, count }) => ({ range: label, count }));
}
