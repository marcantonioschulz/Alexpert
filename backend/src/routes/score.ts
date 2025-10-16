import crypto from 'node:crypto';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { openAIRequestCounter, openAITokenCounter } from '../lib/metrics.js';

const systemPrompt = `Bewerte dieses Verkaufsgespräch nach Klarheit, Bedarfsermittlung, Einwandbehandlung.
Antworte ausschließlich als JSON im Format {"score": number, "feedback": string}.`;

export async function scoreRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/score',
    {
      schema: {
        body: z.object({
          conversationId: z.string().optional(),
          transcript: z.string().optional(),
          stream: z.boolean().optional()
        }),
        response: {
          200: z.object({
            conversationId: z.string(),
            score: z.number(),
            feedback: z.string()
          }),
          400: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { conversationId, transcript: transcriptFromBody, stream } = request.body;

      if (!conversationId && !transcriptFromBody) {
        return reply.badRequest('conversationId oder transcript erforderlich');
      }

      const conversation = conversationId
        ? await prisma.conversation.findUnique({ where: { id: conversationId } })
        : null;
      try {
        const { conversationId, transcript: transcriptFromBody } = request.body;

        if (!conversationId && !transcriptFromBody) {
          return sendErrorResponse(
            reply,
            400,
            'score.transcript_required',
            'conversationId oder transcript erforderlich'
          );
        }
        const conversation = conversationId
          ? await prisma.conversation.findUnique({ where: { id: conversationId } })
          : null;

        if (conversationId && !conversation) {
          return sendErrorResponse(
            reply,
            404,
            'score.conversation_not_found',
            'Conversation not found',
            { conversationId }
          );
        }

        const transcript = transcriptFromBody ?? conversation?.transcript;

        if (!transcript) {
          return sendErrorResponse(
            reply,
            400,
            'score.transcript_missing',
            'Kein Transkript vorhanden',
            conversationId ? { conversationId } : undefined
          );
        }

      const cacheKey = cacheClient.isEnabled()
        ? createCacheKey(env.RESPONSES_MODEL, systemPrompt, transcript)
        : null;

      const cachedScore = cacheKey ? await getCachedScore(cacheKey, request.log) : null;

      if (cachedScore) {
        const boundedCachedScore = boundScore(cachedScore.score);
        const savedConversation = await persistConversation({
          existingConversationId: conversationId,
          transcript,
          score: boundedCachedScore,
          feedback: cachedScore.feedback
        });

        if (stream) {
          reply.hijack();
          reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive'
          });

          const summaryEvent = {
            type: 'score.summary',
            conversationId: savedConversation.id,
            score: boundedCachedScore,
            feedback: cachedScore.feedback,
            cached: true
          };
          reply.raw.write(`data: ${JSON.stringify(summaryEvent)}\n\n`);
          reply.raw.end();
          return;
        }

        return reply.send({
          conversationId: savedConversation.id,
          score: boundedCachedScore,
          feedback: cachedScore.feedback
        });
      }

      const requestPayload = {
        model: env.RESPONSES_MODEL,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'text' as const,
                text: systemPrompt
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'text' as const,
                text: transcript
              }
            ]
          }
        ],
        stream: Boolean(stream)
      };

      if (stream) {
        const response = await openAIClient.responses(requestPayload, { stream: true });

        if (!response.ok) {
          const errorText = await response.text();
          request.log.error({ errorText }, 'Failed to fetch streaming score from OpenAI');
          return reply.status(500).send({ message: 'Score request failed' });
        }

        if (!response.body) {
          request.log.error('Streaming response missing body');
          return reply.status(500).send({ message: 'Streaming not available' });
        }

        const capturedChunks: string[] = [];

        reply.hijack();
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        });

        const streamCompletion = new Promise<void>((resolve) => {
          response.body?.on('data', (chunk: Buffer) => {
            const textChunk = chunk.toString();
            capturedChunks.push(textChunk);
            reply.raw.write(chunk);
          });

          response.body?.once('end', async () => {
            try {
              const aggregatedText = capturedChunks.join('');
              const finalText = extractTextFromSSE(aggregatedText);
              const parsedScore = parseScorePayload(finalText, request.log);

              if (parsedScore) {
                const boundedScore = boundScore(parsedScore.score);
                const savedConversation = await persistConversation({
                  existingConversationId: conversationId,
                  transcript,
                  score: boundedScore,
                  feedback: parsedScore.feedback
                });

                if (cacheKey) {
                  await setCachedScore(cacheKey, { score: boundedScore, feedback: parsedScore.feedback }, request.log);
                }

                const summaryEvent = {
                  type: 'score.summary',
                  conversationId: savedConversation.id,
                  score: boundedScore,
                  feedback: parsedScore.feedback
                };
                reply.raw.write(`data: ${JSON.stringify(summaryEvent)}\n\n`);
              } else {
                reply.raw.write(
                  `data: ${JSON.stringify({ type: 'score.error', message: 'Antwort konnte nicht interpretiert werden' })}\n\n`
                );
              }
            } catch (error) {
              request.log.error({ error }, 'Failed to finalize streaming score');
              reply.raw.write(
                `data: ${JSON.stringify({ type: 'score.error', message: 'Finalisierung des Streams fehlgeschlagen' })}\n\n`
              );
            } finally {
              reply.raw.end();
              resolve();
            }
          });

          response.body?.once('error', (error: unknown) => {
            request.log.error({ error }, 'Streaming connection error');
            reply.raw.write(
              `data: ${JSON.stringify({ type: 'score.error', message: 'Streaming-Fehler bei der Auswertung' })}\n\n`
            );
            reply.raw.end();
            resolve();
          });
        });

        await streamCompletion;
        return;
      }

      const response = await openAIClient.responses(requestPayload);

      openAIRequestCounter.inc({
        endpoint: 'responses',
        status: response.ok ? 'success' : 'error'
      });

      if (!response.ok) {
        const errorText = await response.text();
        request.log.error({ errorText }, 'Failed to fetch score from OpenAI');
        return reply.status(500).send({ message: 'Score request failed' });
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
        }>;
        content?: Array<{
          text?: string;
        }>;
      };

      const textContent =
        payload.output?.[0]?.content?.[0]?.text ??
        payload.content?.[0]?.text ??
        '';

      const usage = (payload as { usage?: { total_tokens?: number } }).usage;
      if (usage?.total_tokens) {
        openAITokenCounter.inc({ endpoint: 'responses' }, usage.total_tokens);
      }

      let parsed: { score: number; feedback: string } | null = null;

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

        return reply.send({
          conversationId: updatedConversation.id,
          score: boundedScore,
          feedback: parsed.feedback
        });
      } catch (err) {
        request.log.error({ err, route: 'score:evaluate' });
        const message = err instanceof Error ? err.message : 'Score request failed';
        return sendErrorResponse(reply, 500, 'score.request_failed', message);
      }

      const boundedScore = boundScore(parsed.score);

      const updatedConversation = await persistConversation({
        existingConversationId: conversationId,
        transcript,
        score: boundedScore,
        feedback: parsed.feedback
      });

      if (cacheKey) {
        await setCachedScore(cacheKey, { score: boundedScore, feedback: parsed.feedback }, request.log);
      }

      return reply.send({
        conversationId: updatedConversation.id,
        score: boundedScore,
        feedback: parsed.feedback
      });
    }
  );
}

function parseScorePayload(
  textContent: string,
  logger: FastifyBaseLogger
): { score: number; feedback: string } | null {
  if (!textContent) {
    return null;
  }

  try {
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as { score: number; feedback: string };
    }
  } catch (error) {
    logger.warn({ error }, 'Failed to parse score payload');
  }

  return null;
}

function extractTextFromSSE(streamContent: string): string {
  if (!streamContent) {
    return '';
  }

  const lines = streamContent.split(/\r?\n/);
  let aggregated = '';

  for (const line of lines) {
    if (!line.startsWith('data:')) {
      continue;
    }

    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') {
      continue;
    }

    try {
      const parsed = JSON.parse(data) as { type?: string; delta?: string; content?: Array<{ text?: string }>; text?: string };

      if (parsed.type === 'response.output_text.delta' && parsed.delta) {
        aggregated += parsed.delta;
      } else if (parsed.type === 'response.output_text.done') {
        if (parsed.text) {
          aggregated += parsed.text;
        }
      } else if (Array.isArray(parsed.content) && parsed.content[0]?.text) {
        aggregated += parsed.content[0].text ?? '';
      } else if (typeof parsed.text === 'string') {
        aggregated += parsed.text;
      }
    } catch (error) {
      // Ignore malformed lines
    }
  }

  return aggregated;
}

function boundScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

function createCacheKey(model: string, prompt: string, transcript: string): string {
  return crypto.createHash('sha256').update(model).update('\0').update(prompt).update('\0').update(transcript).digest('hex');
}

async function getCachedScore(
  key: string,
  logger: FastifyBaseLogger
): Promise<{ score: number; feedback: string } | null> {
  try {
    const cached = await cacheClient.get(key);
    return cached ? (JSON.parse(cached) as { score: number; feedback: string }) : null;
  } catch (error) {
    logger.warn({ error }, 'Failed to retrieve cached score');
    return null;
  }
}

async function setCachedScore(
  key: string,
  value: { score: number; feedback: string },
  logger: FastifyBaseLogger
): Promise<void> {
  try {
    await cacheClient.set(key, JSON.stringify(value));
  } catch (error) {
    logger.warn({ error }, 'Failed to store score cache');
  }
}

async function persistConversation({
  existingConversationId,
  transcript,
  score,
  feedback
}: {
  existingConversationId?: string;
  transcript: string;
  score: number;
  feedback: string;
}) {
  if (existingConversationId) {
    return prisma.conversation.update({
      where: { id: existingConversationId },
      data: { score, feedback }
    });
  }

  return prisma.conversation.create({
    data: {
      userId: 'demo-user',
      transcript,
      score,
      feedback
    }
  });
}
