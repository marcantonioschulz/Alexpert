export type AnalyticsSummary = {
  totalConversations: number;
  scoredConversations: number;
  averageScore: number | null;
  lastConversationAt: string | null;
  lastSevenDays: number;
  bestScore: { conversationId: string; score: number } | null;
  lowestScore: { conversationId: string; score: number } | null;
};

export type AnalyticsTrendPoint = {
  date: string;
  conversations: number;
  averageScore: number | null;
};

export type ScoreDistributionPoint = {
  range: string;
  count: number;
};
