import type { Conversation } from '@prisma/client';
import type { UserPreference } from '@prisma/client';

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
