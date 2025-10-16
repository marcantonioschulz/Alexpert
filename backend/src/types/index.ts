import type { Conversation, ConversationLog } from '@prisma/client';

export type ConversationResponse = Conversation;
export type ConversationLogResponse = ConversationLog;

export type ConversationDto = {
  id: string;
  transcript: string | null;
  score: number | null;
  feedback: string | null;
  createdAt: string;
};

export type AnalyticsSummary = {
  totalConversations: number;
  scoredConversations: number;
  averageScore: number | null;
  lastConversationAt: string | null;
  lastSevenDays: number;
  bestScore: { conversationId: string; score: number } | null;
  lowestScore: { conversationId: string; score: number } | null;
};

export type AnalyticsDailyTrend = {
  date: string;
  conversations: number;
  averageScore: number | null;
};

export type ScoreDistributionBucket = {
  range: string;
  count: number;
};
