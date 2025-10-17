import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import { env } from '../lib/env.js';
import { ConversationLogType } from '../types/index.js';
import { getUserPreferences, resolveOpenAIKey } from '../lib/preferences.js';
import { openAIClient } from './openaiClient.js';
import { ServiceError } from './errors.js';
import { PromptKey, getPromptValue } from './promptService.js';

export type EvaluationResult = {
  score: number;
  feedback: string;
  raw: string;
};

export function parseScorePayload(
  textContent: string,
  logger: FastifyBaseLogger
): { score: number; feedback: string } | null {
  if (!textContent) {
    return null;
  }

  try {
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { score?: number; feedback?: string };
      if (typeof parsed.score === 'number' && typeof parsed.feedback === 'string') {
        return { score: parsed.score, feedback: parsed.feedback };
      }
    }
  } catch (error) {
    logger.warn({ error }, 'Failed to parse score payload');
  }

  return null;
}

function extractTextFromResponsePayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const candidate = payload as {
    output?: Array<{
      content?: Array<{ text?: string; type?: string; output_text?: string }>;
      output_text?: string;
    }>;
    output_text?: string;
  };

  if (typeof candidate.output_text === 'string') {
    return candidate.output_text;
  }

  if (Array.isArray(candidate.output)) {
    const textChunks: string[] = [];

    for (const entry of candidate.output) {
      if (typeof entry?.output_text === 'string') {
        textChunks.push(entry.output_text);
      }

      if (Array.isArray(entry?.content)) {
        for (const content of entry.content) {
          if (typeof content?.text === 'string') {
            textChunks.push(content.text);
          }
        }
      }
    }

    return textChunks.join('').trim();
  }

  return '';
}

async function requestEvaluation(
  transcript: string,
  apiKey: string,
  model: string,
  logger: FastifyBaseLogger,
  prisma: PrismaClient
): Promise<EvaluationResult> {
  const scoringPrompt = await getPromptValue(prisma, PromptKey.SCORING);

  const response = await openAIClient.responses(
    {
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: scoringPrompt
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: transcript
            }
          ]
        }
      ]
    },
    { apiKeyOverride: apiKey }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ errorText }, 'Failed to fetch score from OpenAI');
    throw new ServiceError('UPSTREAM_ERROR', 'Score request failed', { cause: new Error(errorText) });
  }

  const payload = await response.json();
  const aggregated = extractTextFromResponsePayload(payload);
  const parsed = parseScorePayload(aggregated, logger);

  if (!parsed) {
    logger.error({ aggregated }, 'Failed to parse score payload');
    throw new ServiceError('UPSTREAM_ERROR', 'Antwort konnte nicht interpretiert werden');
  }

  const boundedScore = Math.min(100, Math.max(0, Math.round(parsed.score)));

  return {
    score: boundedScore,
    feedback: parsed.feedback,
    raw: aggregated
  };
}

export async function scoreTranscriptForUser({
  prisma,
  transcript,
  userId,
  logger
}: {
  prisma: PrismaClient;
  transcript: string;
  userId: string;
  logger: FastifyBaseLogger;
}): Promise<EvaluationResult> {
  const preferences = await getUserPreferences(userId);
  const apiKey = resolveOpenAIKey(preferences);
  const model = preferences.responsesModel ?? env.RESPONSES_MODEL;

  return requestEvaluation(transcript, apiKey, model, logger, prisma);
}

export async function evaluateAndPersistConversation({
  prisma,
  conversationId,
  transcript,
  userId,
  logger
}: {
  prisma: PrismaClient;
  conversationId: string;
  transcript: string;
  userId: string;
  logger: FastifyBaseLogger;
}) {
  const evaluation = await scoreTranscriptForUser({ prisma, transcript, userId, logger });

  const conversation = await prisma.$transaction(async (tx) => {
    const updatedConversation = await tx.conversation.update({
      where: { id: conversationId },
      data: {
        score: evaluation.score,
        feedback: evaluation.feedback
      }
    });

    await tx.conversationLog.create({
      data: {
        conversationId,
        role: 'system',
        type: ConversationLogType.AI_FEEDBACK,
        content: evaluation.feedback,
        context: {
          score: evaluation.score
        }
      }
    });

    await tx.conversationLog.create({
      data: {
        conversationId,
        role: 'system',
        type: ConversationLogType.SCORING_CONTEXT,
        content: evaluation.raw,
        context: {
          score: evaluation.score,
          feedback: evaluation.feedback
        }
      }
    });

    return updatedConversation;
  });

  return {
    conversation,
    evaluation
  };
}
