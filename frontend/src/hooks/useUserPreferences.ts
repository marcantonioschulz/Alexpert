import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ThemePreference, UserPreferences } from '../types/preferences';
import { API_HEADERS, type ApiResponse } from '../utils/api';

const DEFAULT_THEME: ThemePreference = 'system';

export const useUserPreferences = (userId: string) => {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [initialPreferences, setInitialPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalize = useCallback(
    (value: UserPreferences | null): UserPreferences | null => {
      if (!value) {
        return value;
      }

      return {
        userId: value.userId,
        realtimeModel: value.realtimeModel,
        responsesModel: value.responsesModel,
        apiKeyOverride: value.apiKeyOverride ?? null,
        theme: value.theme ?? DEFAULT_THEME
      };
    },
    []
  );

  useEffect(() => {
    let isActive = true;

    async function loadPreferences() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ userId });
        const response = await fetch(`/api/user/preferences?${params.toString()}`, {
          headers: {
            ...(API_HEADERS ?? {})
          }
        });

        if (!response.ok) {
          throw new Error('Einstellungen konnten nicht geladen werden.');
        }

        const payload = (await response.json()) as ApiResponse<UserPreferences>;
        if (!payload.success) {
          throw new Error('Einstellungen konnten nicht geladen werden.');
        }
        if (!isActive) {
          return;
        }

        const normalized = normalize(payload.data);
        setPreferences(normalized);
        setInitialPreferences(normalized);
      } catch (err) {
        if (!isActive) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler beim Laden');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadPreferences();

    return () => {
      isActive = false;
    };
  }, [normalize, userId]);

  const hasChanges = useMemo(() => {
    if (!preferences || !initialPreferences) {
      return false;
    }

    return JSON.stringify(normalize(preferences)) !== JSON.stringify(normalize(initialPreferences));
  }, [initialPreferences, normalize, preferences]);

  const updatePreference = useCallback((next: Partial<UserPreferences>) => {
    setPreferences((current) => (current ? { ...current, ...next } : current));
  }, []);

  const savePreferences = useCallback(async () => {
    if (!preferences) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_HEADERS ?? {})
        },
        body: JSON.stringify({
          ...preferences,
          apiKeyOverride: preferences.apiKeyOverride?.trim() ? preferences.apiKeyOverride.trim() : null
        })
      });

      if (!response.ok) {
        throw new Error('Einstellungen konnten nicht gespeichert werden.');
      }

      const payload = (await response.json()) as ApiResponse<UserPreferences>;
      if (!payload.success) {
        throw new Error('Einstellungen konnten nicht gespeichert werden.');
      }
      const normalized = normalize(payload.data);
      setPreferences(normalized);
      setInitialPreferences(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  }, [preferences, normalize]);

  return {
    preferences,
    updatePreference,
    savePreferences,
    isLoading,
    isSaving,
    error,
    hasChanges
  };
};
