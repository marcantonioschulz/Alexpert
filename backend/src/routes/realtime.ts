import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import fetch from 'node-fetch';
import { env } from '../lib/env.js';
import { getUserPreferences, resolveOpenAIKey } from '../lib/preferences.js';
import { prisma } from '../lib/prisma.js';
import { errorResponseSchema, sendErrorResponse } from './error-response.js';
import { PromptKey, getPromptValue } from '../services/promptService.js';
import { realtimeSessionManager } from '../services/realtimeSessionManager.js';
import { ServiceError } from '../services/errors.js';
import { persistConversationTranscript } from '../services/conversationService.js';
import { evaluateAndPersistConversation } from '../services/evaluationService.js';

export async function realtimeRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/realtime/session',
    {
      schema: {
        body: z.object({
          sdp: z.string(),
          conversationId: z.string(),
          token: z.string().optional(),
          model: z.string().optional(),
          userId: z.string().optional(),
          voice: z.string().optional()
        }),
        response: {
          200: z.object({ sdp: z.string() }),
          500: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const userId = request.body.userId ?? 'demo-user';
        const preferences = await getUserPreferences(userId);
        const model = request.body.model ?? preferences.realtimeModel ?? env.REALTIME_MODEL;
        const bearerToken = request.body.token ?? resolveOpenAIKey(preferences);

        const [systemPrompt, rolePrompt] = await Promise.all([
          getPromptValue(prisma, PromptKey.REALTIME_SYSTEM),
          getPromptValue(prisma, PromptKey.REALTIME_ROLE)
        ]);

        const sessionOptions = {
          instructions: systemPrompt,
          modalities: ['text', 'audio'],
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          voice: request.body.voice ?? 'alloy',
          turn_detection: { type: 'server_vad' as const },
          input_audio_transcription: {
            enabled: true,
            model: 'gpt-4o-mini-transcribe'
          },
          metadata: {
            conversationId: request.body.conversationId,
            rolePrompt
          }
        };

        const response = await fetch(`https://api.openai.com/v1/realtime?model=${model}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            'Content-Type': 'application/sdp',
            'OpenAI-Beta': 'realtime=v1',
            'OpenAI-Session-Options': JSON.stringify(sessionOptions)
          },
          body: request.body.sdp
        });

        if (!response.ok) {
          const errorText = await response.text();

          // Parse OpenAI error if possible
          let errorDetails = errorText;
          try {
            const errorJson = JSON.parse(errorText);
            errorDetails = errorJson.error?.message || errorText;
          } catch {
            // errorText is not JSON, use as is
          }

          // Log with comprehensive context for debugging
          request.log.error({
            err: errorDetails,
            route: 'realtime:session',
            status: response.status,
            conversationId: request.body.conversationId,
            model,
            // Only log first 10 characters of API key for security
            apiKeyPrefix: bearerToken.substring(0, 10),
            userId
          });

          // Log error to database for debugging
          try {
            await prisma.conversationLog.create({
              data: {
                conversationId: request.body.conversationId,
                role: 'system',
                type: 'ERROR',
                content: `Realtime API Error ${response.status}: ${errorDetails || 'Unknown error'}`,
                context: JSON.stringify({
                  model,
                  userId,
                  hasCustomKey: !!preferences?.apiKeyOverride,
                  statusCode: response.status
                })
              }
            });
          } catch (logError) {
            request.log.warn({ err: logError }, 'Failed to log conversation error to database');
          }

          // Return user-friendly error messages based on status code
          let userMessage = 'Verbindung zur OpenAI Realtime API fehlgeschlagen.';
          let errorCode = 'realtime.session_failed';

          if (response.status === 401) {
            userMessage =
              'Ungültiger API-Schlüssel. Bitte überprüfe deine Einstellungen.';
            errorCode = 'realtime.invalid_api_key';
          } else if (response.status === 403) {
            userMessage =
              'Dein API-Schlüssel hat keinen Zugriff auf die Realtime API. ' +
              'Bitte überprüfe deine OpenAI-Berechtigungen oder verwende den System-API-Schlüssel.';
            errorCode = 'realtime.no_realtime_access';
          } else if (response.status === 429) {
            userMessage =
              'Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.';
            errorCode = 'realtime.rate_limit';
          }

          return sendErrorResponse(reply, 500, errorCode, userMessage);
        }

        const answer = await response.text();

        const conversationId = request.body.conversationId;
        const timestamp = new Date().toISOString();
        realtimeSessionManager.emit(conversationId, {
          type: 'session.started',
          conversationId,
          model,
          timestamp
        });
        realtimeSessionManager.emit(conversationId, {
          type: 'status',
          status: 'session.negotiated',
          conversationId,
          detail: { model }
        });

        return reply.send({ sdp: answer });
      } catch (err) {
        request.log.error({ err, route: 'realtime:session' });
        const message = err instanceof Error ? err.message : 'Realtime negotiation failed';
        return sendErrorResponse(reply, 500, 'realtime.session_failed', message);
      }
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/realtime/:conversationId/events',
    {
      schema: {
        params: z.object({ conversationId: z.string() }),
        response: {
          200: z.any(),
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { conversationId } = request.params;

      const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conversation) {
        return sendErrorResponse(reply, 404, 'realtime.not_found', 'Conversation not found');
      }

      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');
      reply.raw.flushHeaders?.();

      const unsubscribe = realtimeSessionManager.subscribe(conversationId, (event) => {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      const heartbeat = setInterval(() => {
        reply.raw.write(`event: ping\ndata: ${Date.now()}\n\n`);
      }, 15000);

      request.raw.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });

      return reply; // keep connection open
    }
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/realtime/:conversationId/finalize',
    {
      schema: {
        params: z.object({ conversationId: z.string() }),
        body: z.object({
          transcript: z.string().optional(),
          userId: z.string().optional()
        }),
        response: {
          200: z.object({
            conversationId: z.string(),
            transcript: z.string(),
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
      const { conversationId } = request.params;
      try {
        const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });

        if (!conversation) {
          throw new ServiceError('NOT_FOUND', 'Conversation not found');
        }

        const transcriptFromBody = request.body.transcript?.trim() ?? '';
        const userId = request.body.userId ?? conversation.userId ?? 'demo-user';

        realtimeSessionManager.emit(conversationId, {
          type: 'status',
          status: 'finalizing',
          conversationId
        });

        let transcript = conversation.transcript ?? '';

        if (transcriptFromBody.length > 0) {
          realtimeSessionManager.emit(conversationId, {
            type: 'status',
            status: 'transcript.saving',
            conversationId
          });

          const persisted = await persistConversationTranscript(
            prisma,
            conversationId,
            transcriptFromBody
          );
          transcript = persisted.transcript ?? transcriptFromBody;

          realtimeSessionManager.emit(conversationId, {
            type: 'transcript.saved',
            conversationId,
            transcript
          });
        }

        if (!transcript || transcript.trim().length === 0) {
          throw new ServiceError('BAD_REQUEST', 'Kein Transkript vorhanden');
        }

        realtimeSessionManager.emit(conversationId, {
          type: 'status',
          status: 'evaluation.started',
          conversationId
        });

        const { evaluation } = await evaluateAndPersistConversation({
          prisma,
          conversationId,
          transcript,
          userId,
          logger: request.log
        });

        realtimeSessionManager.emit(conversationId, {
          type: 'score.completed',
          conversationId,
          score: evaluation.score,
          feedback: evaluation.feedback
        });

        realtimeSessionManager.emit(conversationId, {
          type: 'status',
          status: 'session.completed',
          conversationId
        });

        realtimeSessionManager.complete(conversationId);

        return reply.send({
          conversationId,
          transcript,
          score: evaluation.score,
          feedback: evaluation.feedback
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Realtime finalization failed';

        realtimeSessionManager.emit(conversationId, {
          type: 'error',
          conversationId,
          message
        });

        if (error instanceof ServiceError) {
          switch (error.code) {
            case 'BAD_REQUEST':
              return sendErrorResponse(reply, 400, 'realtime.finalize_invalid', error.message);
            case 'NOT_FOUND':
              return sendErrorResponse(reply, 404, 'realtime.not_found', error.message);
            case 'UPSTREAM_ERROR':
              return sendErrorResponse(reply, 500, 'realtime.finalize_failed', error.message);
            default:
              break;
          }
        }

        request.log.error({ error, route: 'realtime:finalize' });
        return sendErrorResponse(reply, 500, 'realtime.finalize_failed', message);
      }
    }
  );
}
