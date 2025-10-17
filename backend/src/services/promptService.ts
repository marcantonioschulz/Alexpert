import type { Prisma, PrismaClient } from '@prisma/client';
import { ServiceError } from './errors.js';

type PromptClient = PrismaClient | Prisma.TransactionClient;

export enum PromptKey {
  REALTIME_SYSTEM = 'realtime_system_prompt',
  REALTIME_ROLE = 'realtime_role_prompt',
  SCORING = 'scoring_prompt'
}

export type PromptSettingDto = {
  key: PromptKey;
  value: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type PromptDefault = {
  value: string;
  description: string;
};

export const PROMPT_DEFAULTS: Record<PromptKey, PromptDefault> = {
  [PromptKey.REALTIME_SYSTEM]: {
    value:
      'Du bist ein empathischer, deutschsprachiger Vertriebscoach. Führe ein natürliches Gespräch, biete gezielte Hilfestellungen und bleibe stets professionell.',
    description: 'Systemprompt für die Echtzeit-Sprachsession'
  },
  [PromptKey.REALTIME_ROLE]: {
    value:
      'Der Nutzer trainiert ein Verkaufsgespräch. Stelle Rückfragen, erkenne Bedürfnisse und liefere Antworten in natürlicher Sprache.',
    description: 'Rollenbeschreibung für das Voice-Coaching'
  },
  [PromptKey.SCORING]: {
    value:
      'Bewerte dieses Verkaufsgespräch nach Klarheit, Bedarfsermittlung, Nutzenargumentation und Einwandbehandlung. Antworte ausschließlich als JSON im Format {"score": number, "feedback": string}. Score muss zwischen 0 und 100 liegen.',
    description: 'Bewertungslogik für GPT-Auswertung'
  }
};

function resolveDefault(key: PromptKey): PromptDefault {
  const defaults = PROMPT_DEFAULTS[key];
  if (!defaults) {
    throw new ServiceError('BAD_REQUEST', `Unknown prompt key: ${key}`);
  }

  return defaults;
}

async function findPrompt(client: PromptClient, key: PromptKey) {
  return client.promptSetting.findUnique({ where: { key } });
}

export async function ensurePromptValue(
  client: PromptClient,
  key: PromptKey
): Promise<string> {
  const existing = await findPrompt(client, key);
  if (existing) {
    return existing.value;
  }

  const defaults = resolveDefault(key);
  const created = await client.promptSetting.create({
    data: {
      key,
      value: defaults.value,
      description: defaults.description
    }
  });

  return created.value;
}

export async function getPromptValue(client: PromptClient, key: PromptKey): Promise<string> {
  const existing = await findPrompt(client, key);
  if (existing) {
    return existing.value;
  }

  return ensurePromptValue(client, key);
}

export async function listPromptSettings(client: PromptClient): Promise<PromptSettingDto[]> {
  const prompts = await client.promptSetting.findMany({
    orderBy: { key: 'asc' }
  });

  return prompts.map((prompt) => ({
    key: prompt.key as PromptKey,
    value: prompt.value,
    description: prompt.description ?? null,
    createdAt: prompt.createdAt.toISOString(),
    updatedAt: prompt.updatedAt.toISOString()
  }));
}

export async function setPromptValue(
  client: PromptClient,
  key: PromptKey,
  value: string,
  description?: string | null
): Promise<PromptSettingDto> {
  if (!value || value.trim().length === 0) {
    throw new ServiceError('BAD_REQUEST', 'Prompt value must not be empty');
  }

  const defaults = resolveDefault(key);
  const updated = await client.promptSetting.upsert({
    where: { key },
    update: {
      value,
      description: description ?? defaults.description
    },
    create: {
      key,
      value,
      description: description ?? defaults.description
    }
  });

  return {
    key: updated.key as PromptKey,
    value: updated.value,
    description: updated.description ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString()
  };
}
