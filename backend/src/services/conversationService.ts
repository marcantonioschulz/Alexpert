import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { ConversationDto, ConversationResponse } from '../types/index.js';
import { ServiceError } from './errors.js';

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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
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
