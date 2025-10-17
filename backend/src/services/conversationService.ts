import type { PrismaClient } from '@prisma/client';
import type { ConversationDto, ConversationResponse } from '../types/index.js';
import { ConversationLogType } from '../types/index.js';
import { ServiceError } from './errors.js';

type RecordNotFoundError = { code?: unknown };

function isRecordNotFoundError(error: unknown): error is RecordNotFoundError & { code: string } {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as RecordNotFoundError;
  return typeof candidate.code === 'string' && candidate.code === 'P2025';
}

function formatConversation(conversation: ConversationResponse): ConversationDto {
  return {
    ...conversation,
    createdAt: conversation.createdAt.toISOString()
  };
}

export async function createConversation(
  prisma: PrismaClient,
  userId: string = 'demo-user'
): Promise<ConversationDto> {
  const conversation = await prisma.conversation.create({
    data: {
      userId
    }
  });

  return formatConversation(conversation);
}

export async function updateConversationTranscript(
  prisma: PrismaClient,
  id: string,
  transcript: string
): Promise<ConversationDto> {
  try {
    const conversation = await prisma.conversation.update({
      where: { id },
      data: { transcript }
    });

    return formatConversation(conversation);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      throw new ServiceError('NOT_FOUND', 'Conversation not found', { cause: error });
    }

    throw error;
  }
}

export async function persistConversationTranscript(
  prisma: PrismaClient,
  id: string,
  transcript: string
): Promise<ConversationDto> {
  try {
    return await prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.update({
        where: { id },
        data: { transcript }
      });

      await tx.conversationLog.create({
        data: {
          conversationId: id,
          role: 'user',
          type: ConversationLogType.TRANSCRIPT,
          content: transcript
        }
      });

      return formatConversation(conversation);
    });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      throw new ServiceError('NOT_FOUND', 'Conversation not found', { cause: error });
    }

    throw error;
  }
}

export async function getConversation(
  prisma: PrismaClient,
  id: string
): Promise<ConversationDto> {
  const conversation = await prisma.conversation.findUnique({
    where: { id }
  });

  if (!conversation) {
    throw new ServiceError('NOT_FOUND', 'Conversation not found');
  }

  return formatConversation(conversation);
}
