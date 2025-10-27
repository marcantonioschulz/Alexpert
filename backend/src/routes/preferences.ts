import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getUserPreferences, saveUserPreferences } from '../lib/preferences.js';
import { sendErrorResponse } from './error-response.js';
import { validateOpenAIKey } from '../services/apiKeyValidator.js';
import { optionalClerkAuth } from '../middleware/clerk-auth.js';

const themeEnum = z.enum(['light', 'dark', 'system']);

const preferencesSchema = z.object({
  userId: z.string(),
  realtimeModel: z.string(),
  responsesModel: z.string(),
  apiKeyOverride: z.string().nullable(),
  theme: themeEnum
});

const preferencesResponseSchema = z.object({
  success: z.literal(true),
  data: preferencesSchema,
  timestamp: z.string()
});

export async function preferencesRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/user/preferences',
    {
      preHandler: [optionalClerkAuth],
      schema: {
        querystring: z.object({
          userId: z.string().optional()
        }),
        response: {
          200: preferencesResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        // Use authenticated user ID if available, otherwise fallback to query param or demo-user
        const userId = request.user?.id || request.query.userId || 'demo-user';
        request.log.info({ userId, authenticated: !!request.user }, 'Fetching user preferences');
        const preferences = await getUserPreferences(userId);
        return reply.send({
          success: true as const,
          data: preferences,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to fetch preferences');
        return sendErrorResponse(reply, 500, 'PREFERENCES_FETCH_ERROR', 'Failed to fetch preferences');
      }
    }
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/user/preferences',
    {
      preHandler: [optionalClerkAuth],
      schema: {
        body: z.object({
          userId: z.string().optional(),
          realtimeModel: z.string(),
          responsesModel: z.string(),
          apiKeyOverride: z.string().nullable(),
          theme: themeEnum
        }),
        response: {
          200: preferencesResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        // Use authenticated user ID if available, otherwise fallback to body or demo-user
        const userId = request.user?.id || request.body.userId || 'demo-user';
        const payload = {
          realtimeModel: request.body.realtimeModel,
          responsesModel: request.body.responsesModel,
          apiKeyOverride: request.body.apiKeyOverride,
          theme: request.body.theme
        };

        // Validate API key if provided
        if (payload.apiKeyOverride) {
          request.log.info({ userId }, 'Validating custom API key');

          const validation = await validateOpenAIKey(payload.apiKeyOverride);

          if (!validation.valid) {
            request.log.warn(
              { userId, error: validation.error },
              'Invalid API key provided'
            );
            return sendErrorResponse(
              reply,
              400,
              'PREFERENCES_INVALID_API_KEY',
              'Der eingegebene API-Schlüssel ist ungültig. Bitte überprüfe den Schlüssel und versuche es erneut.',
              { reason: validation.error }
            );
          }

          if (!validation.hasRealtimeAccess) {
            request.log.warn(
              { userId },
              'API key does not have Realtime API access'
            );
            return sendErrorResponse(
              reply,
              400,
              'PREFERENCES_NO_REALTIME_ACCESS',
              'Dieser API-Schlüssel hat keinen Zugriff auf die OpenAI Realtime API. Bitte überprüfe deine Berechtigungen unter platform.openai.com oder verwende den System-API-Schlüssel.',
              {
                hint: 'Die Realtime API erfordert spezielle Berechtigungen in deinem OpenAI-Konto.'
              }
            );
          }

          request.log.info({ userId, authenticated: !!request.user }, 'API key validated successfully');
        }

        request.log.info({ userId, authenticated: !!request.user }, 'Saving user preferences');
        const preferences = await saveUserPreferences(userId, payload);
        return reply.send({
          success: true as const,
          data: preferences,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to save preferences');
        return sendErrorResponse(reply, 500, 'PREFERENCES_SAVE_ERROR', 'Failed to save preferences');
      }
    }
  );
}
