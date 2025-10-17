import type { PrismaClient } from '@prisma/client';
import { ServiceError } from './errors.js';
import { clearAnalyticsCache } from './analyticsService.js';

const systemPrompt = `Bewerte dieses Verkaufsgespräch nach Klarheit, Bedarfsermittlung, Einwandbehandlung.
Antworte ausschließlich als JSON im Format {"score": number, "feedback": string}.`;

interface ScoreServiceEnv {
  OPENAI_API_KEY: string;
  RESPONSES_MODEL: string;
}

type FetchLike = (typeof globalThis)['fetch'];

interface ScoreServiceDependencies {
  prisma: PrismaClient;
  fetch: FetchLike;
  env: ScoreServiceEnv;
}

export interface ScoreRequest {
  conversationId?: string;
  transcript?: string;
}

export interface ScoreResponse {
  conversationId: string;
  score: number;
  feedback: string;
}

export async function scoreConversation(
  deps: ScoreServiceDependencies,
  request: ScoreRequest
): Promise<ScoreResponse> {
  const { prisma, fetch, env } = deps;
  const { conversationId, transcript: transcriptFromBody } = request;

  if (!conversationId && !transcriptFromBody) {
    throw new ServiceError('BAD_REQUEST', 'conversationId oder transcript erforderlich');
  }

  const conversation = conversationId
    ? await prisma.conversation.findUnique({ where: { id: conversationId } })
    : null;

  if (conversationId && !conversation) {
    throw new ServiceError('NOT_FOUND', 'Conversation not found');
  }

  const transcript = transcriptFromBody ?? conversation?.transcript ?? null;

  if (!transcript) {
    throw new ServiceError('BAD_REQUEST', 'Kein Transkript vorhanden');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.RESPONSES_MODEL,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: systemPrompt
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
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ServiceError('UPSTREAM_ERROR', 'Score request failed', {
      cause: new Error(errorText)
    });
  }

  const payload = (await response.json()) as Record<string, unknown> & {
    output?: Array<{
      content?: Array<{
        text?: string;
      }>;
    }>;
    content?: Array<{
      text?: string;
    }>;
  };

  const textContent =
    payload.output?.[0]?.content?.[0]?.text ?? payload.content?.[0]?.text ?? '';

  let parsed: { score: number; feedback: string } | null = null;

  try {
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]) as { score: number; feedback: string };
    }
  } catch (error) {
    throw new ServiceError('UPSTREAM_ERROR', 'Antwort konnte nicht interpretiert werden', {
      cause: error instanceof Error ? error : undefined
    });
  }

  if (!parsed) {
    throw new ServiceError('UPSTREAM_ERROR', 'Antwort konnte nicht interpretiert werden');
  }

  const boundedScore = Math.min(100, Math.max(0, Math.round(parsed.score)));

  const updatedConversation = conversationId
    ? await prisma.conversation.update({
        where: { id: conversationId },
        data: { score: boundedScore, feedback: parsed.feedback }
      })
    : await prisma.conversation.create({
        data: {
          userId: 'demo-user',
          transcript,
          score: boundedScore,
          feedback: parsed.feedback
        }
      });

  await clearAnalyticsCache();
  return {
    conversationId: updatedConversation.id,
    score: boundedScore,
    feedback: parsed.feedback
  };
}

export { systemPrompt };
