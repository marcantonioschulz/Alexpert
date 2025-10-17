export enum ConversationLogType {
  TRANSCRIPT = 'TRANSCRIPT',
  AI_FEEDBACK = 'AI_FEEDBACK',
  SCORING_CONTEXT = 'SCORING_CONTEXT'
}

export type ConversationResponse = {
  id: string;
  userId: string;
  transcript: string | null;
  score: number | null;
  feedback: string | null;
  createdAt: Date;
};

export type ConversationLogResponse = {
  id: string;
  conversationId: string;
  role: string;
  type: ConversationLogType;
  content: string;
  context: unknown | null;
  createdAt: Date;
};

export type ConversationDto = {
  id: string;
  transcript: string | null;
  score: number | null;
  feedback: string | null;
  createdAt: string;
};

export type UserPreferenceResponse = {
  id: number;
  userId: string;
  realtimeModel: string | null;
  responsesModel: string | null;
  apiKeyOverride: string | null;
  theme: string;
  createdAt: Date;
  updatedAt: Date;
};

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
