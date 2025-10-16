import type { Conversation } from '@prisma/client';

export type ConversationResponse = Conversation;

export type ConversationDto = {
  id: string;
  transcript: string | null;
  score: number | null;
  feedback: string | null;
  createdAt: string;
};

export type ErrorResponse = {
  code: string;
  message: string;
  context?: Record<string, unknown>;
};
