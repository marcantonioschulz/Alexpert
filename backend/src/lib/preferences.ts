import { prisma } from './prisma.js';
import { env } from './env.js';

type ThemePreference = 'light' | 'dark' | 'system';

type StoredPreferences = {
  userId: string;
  realtimeModel: string | null;
  responsesModel: string | null;
  apiKeyOverride: string | null;
  theme: string | null;
};

export type UserPreferences = {
  userId: string;
  realtimeModel: string;
  responsesModel: string;
  apiKeyOverride: string | null;
  theme: ThemePreference;
};

const DEFAULT_THEME: ThemePreference = 'system';

const DEFAULT_PREFERENCES = {
  realtimeModel: env.REALTIME_MODEL,
  responsesModel: env.RESPONSES_MODEL,
  apiKeyOverride: null,
  theme: DEFAULT_THEME
} as const;

function normalizeTheme(theme: string | null | undefined): ThemePreference {
  if (theme === 'light' || theme === 'dark' || theme === 'system') {
    return theme;
  }
  return DEFAULT_THEME;
}

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const stored = (await prisma.userPreference.findUnique({
    where: { userId }
  })) as StoredPreferences | null;

  return {
    userId,
    realtimeModel: stored?.realtimeModel ?? DEFAULT_PREFERENCES.realtimeModel,
    responsesModel: stored?.responsesModel ?? DEFAULT_PREFERENCES.responsesModel,
    apiKeyOverride: stored?.apiKeyOverride ?? DEFAULT_PREFERENCES.apiKeyOverride,
    theme: normalizeTheme(stored?.theme)
  };
}

export async function saveUserPreferences(
  userId: string,
  preferences: Omit<UserPreferences, 'userId'>
): Promise<UserPreferences> {
  const normalizedApiKey = preferences.apiKeyOverride?.trim() || null;
  const normalizedTheme = normalizeTheme(preferences.theme);

  const saved = await prisma.userPreference.upsert({
    where: { userId },
    create: {
      userId,
      realtimeModel: preferences.realtimeModel,
      responsesModel: preferences.responsesModel,
      apiKeyOverride: normalizedApiKey,
      theme: normalizedTheme
    },
    update: {
      realtimeModel: preferences.realtimeModel,
      responsesModel: preferences.responsesModel,
      apiKeyOverride: normalizedApiKey,
      theme: normalizedTheme
    }
  });

  return {
    userId,
    realtimeModel: saved.realtimeModel ?? DEFAULT_PREFERENCES.realtimeModel,
    responsesModel: saved.responsesModel ?? DEFAULT_PREFERENCES.responsesModel,
    apiKeyOverride: saved.apiKeyOverride ?? DEFAULT_PREFERENCES.apiKeyOverride,
    theme: normalizeTheme(saved.theme)
  };
}

export function resolveOpenAIKey(preferences: Pick<UserPreferences, 'apiKeyOverride'>) {
  return preferences.apiKeyOverride?.trim() || env.OPENAI_API_KEY;
}
