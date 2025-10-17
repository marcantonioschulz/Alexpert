import { describe, expect, it } from 'vitest';
import { PROMPT_DEFAULTS, PromptKey, getPromptValue, listPromptSettings, setPromptValue } from './promptService.js';

type PromptRecord = {
  key: string;
  value: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function createMockPromptClient() {
  const store = new Map<string, PromptRecord>();

  return {
    promptSetting: {
      findUnique: async ({ where: { key } }: { where: { key: string } }) => store.get(key) ?? null,
      create: async ({ data }: { data: { key: string; value: string; description?: string | null } }) => {
        const record: PromptRecord = {
          key: data.key,
          value: data.value,
          description: data.description ?? null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        store.set(data.key, record);
        return record;
      },
      findMany: async () => Array.from(store.values()),
      upsert: async ({
        where: { key },
        create,
        update
      }: {
        where: { key: string };
        create: { key: string; value: string; description?: string | null };
        update: { value: string; description?: string | null };
      }) => {
        const existing = store.get(key);
        if (existing) {
          existing.value = update.value;
          existing.description = update.description ?? existing.description ?? null;
          existing.updatedAt = new Date();
          return existing;
        }

        const record: PromptRecord = {
          key: create.key,
          value: create.value,
          description: create.description ?? null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        store.set(create.key, record);
        return record;
      }
    }
  };
}

describe('promptService', () => {
  it('returns defaults when no prompt exists', async () => {
    const client = createMockPromptClient();
    const value = await getPromptValue(client, PromptKey.SCORING);
    expect(value).toBe(PROMPT_DEFAULTS[PromptKey.SCORING].value);

    const prompts = await listPromptSettings(client);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({ key: PromptKey.SCORING });
  });

  it('updates prompt values via setPromptValue', async () => {
    const client = createMockPromptClient();
    await getPromptValue(client, PromptKey.REALTIME_SYSTEM);

    const updated = await setPromptValue(client, PromptKey.REALTIME_SYSTEM, 'Test prompt', 'Custom');
    expect(updated.value).toBe('Test prompt');
    expect(updated.description).toBe('Custom');

    const value = await getPromptValue(client, PromptKey.REALTIME_SYSTEM);
    expect(value).toBe('Test prompt');
  });
});
