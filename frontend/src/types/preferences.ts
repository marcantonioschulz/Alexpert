export type ThemePreference = 'light' | 'dark' | 'system';

export type UserPreferences = {
  userId: string;
  realtimeModel: string;
  responsesModel: string;
  apiKeyOverride: string | null;
  theme: ThemePreference;
};
