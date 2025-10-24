import { useCallback, useEffect, useState } from 'react';
import { API_HEADERS } from '../utils/api';

export enum PromptKey {
  REALTIME_SYSTEM = 'realtime_system_prompt',
  REALTIME_ROLE = 'realtime_role_prompt',
  SCORING = 'scoring_prompt'
}

export type Prompt = {
  key: PromptKey;
  value: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export const usePrompts = () => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadPrompts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/prompts', {
        headers: {
          ...(API_HEADERS ?? {})
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load prompts');
      }

      const data = await response.json();
      setPrompts(data.prompts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrompts();
  }, [loadPrompts]);

  const updatePrompt = useCallback(
    async (key: PromptKey, value: string, description?: string) => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/prompts/${key}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(API_HEADERS ?? {})
          },
          body: JSON.stringify({ value, description })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update prompt');
        }

        const updatedPrompt = await response.json();

        // Update local state
        setPrompts((prev) =>
          prev.map((p) => (p.key === key ? updatedPrompt : p))
        );

        return updatedPrompt;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update prompt';
        setError(errorMessage);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const getPrompt = useCallback(
    (key: PromptKey) => {
      return prompts.find((p) => p.key === key);
    },
    [prompts]
  );

  return {
    prompts,
    isLoading,
    error,
    isSaving,
    updatePrompt,
    getPrompt,
    reload: loadPrompts
  };
};
