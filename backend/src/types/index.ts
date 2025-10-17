import type { Conversation, ConversationLog, UserPreference } from '@prisma/client';

export type ConversationResponse = Conversation;
export type ConversationLogResponse = ConversationLog;

export type ConversationDto = {
  id: string;
  transcript: string | null;
  score: number | null;
  feedback: string | null;
  createdAt: string;
};

export type UserPreferenceResponse = UserPreference;

export type ScoreReference = {
  conversationId: string;
  score: number;
};

export type AnalyticsSummary = {
  totalConversations: number;
  scoredConversations: number;
  averageScore: number | null;
  lastConversationAt: string | null;
  lastSevenDays: number;
  bestScore: ScoreReference | null;
  lowestScore: ScoreReference | null;
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
