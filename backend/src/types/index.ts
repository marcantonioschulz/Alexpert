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

export type ConversationLogDto = {
  id: string;
  conversationId: string;
  role: string;
  type: ConversationLog['type'];
  content: string;
  context: unknown | null;
  createdAt: string;
};
