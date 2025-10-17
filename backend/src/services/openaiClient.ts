import fetch, { RequestInit, Response } from 'node-fetch';
import { setTimeout as delay } from 'node:timers/promises';
import { env } from '../lib/env.js';

const DEFAULT_TIMEOUT_MS = env.OPENAI_TIMEOUT_MS ?? 20000;
const DEFAULT_MAX_RETRIES = env.OPENAI_MAX_RETRIES ?? 2;
const DEFAULT_INITIAL_BACKOFF_MS = env.OPENAI_INITIAL_BACKOFF_MS ?? 500;
const DEFAULT_BACKOFF_MULTIPLIER = env.OPENAI_BACKOFF_MULTIPLIER ?? 2;

export interface OpenAIRequestOptions {
  /** Override the number of retries for retryable failures */
  retries?: number;
  /** Timeout in milliseconds before the request is aborted */
  timeoutMs?: number;
  /** Whether we expect a streaming response */
  stream?: boolean;
  /** Optional API key override */
  apiKeyOverride?: string;
}

export interface ResponsesPayload {
  model: string;
  input: unknown;
  stream?: boolean;
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 520, 522, 524]);

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export class OpenAIClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  async responses(
    body: ResponsesPayload,
    options: OpenAIRequestOptions = {}
  ): Promise<Response> {
    const retries = options.retries ?? DEFAULT_MAX_RETRIES;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const stream = options.stream ?? body.stream ?? false;
    const apiKey = options.apiKeyOverride ?? this.apiKey;

    let attempt = 0;
    let lastError: unknown = null;
    let backoffMs = DEFAULT_INITIAL_BACKOFF_MS;

    while (attempt <= retries) {
      try {
        const response = await fetchWithTimeout(
          `${this.baseUrl}/responses`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              ...(stream ? { Accept: 'text/event-stream' } : {})
            },
            body: JSON.stringify({ ...body, stream })
          },
          timeoutMs
        );

        if (response.ok) {
          return response;
        }

        if (!RETRYABLE_STATUS.has(response.status) || attempt === retries) {
          return response;
        }

        await delay(backoffMs);
        backoffMs *= DEFAULT_BACKOFF_MULTIPLIER;
        attempt += 1;
        continue;
      } catch (error) {
        lastError = error;

        const isAbortError =
          error instanceof Error &&
          (error.name === 'AbortError' || error.name === 'TimeoutError');

        if (!isAbortError && attempt === retries) {
          throw error;
        }

        if (attempt === retries) {
          throw error;
        }

        await delay(backoffMs);
        backoffMs *= DEFAULT_BACKOFF_MULTIPLIER;
        attempt += 1;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('OpenAI request failed');
  }
}

export const openAIClient = new OpenAIClient('https://api.openai.com/v1', env.OPENAI_API_KEY);
