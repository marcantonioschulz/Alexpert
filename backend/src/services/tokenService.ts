import { ServiceError } from './errors.js';

interface TokenServiceEnv {
  OPENAI_API_KEY: string;
  REALTIME_MODEL: string;
}

type FetchLike = (typeof globalThis)['fetch'];

interface TokenServiceDependencies {
  fetch: FetchLike;
  env: TokenServiceEnv;
}

export interface TokenRequest {
  model?: string;
}

export interface TokenResponse {
  token: string;
  expiresIn: number;
}

export async function createEphemeralToken(
  deps: TokenServiceDependencies,
  request: TokenRequest
): Promise<TokenResponse> {
  const { fetch, env } = deps;
  const model = request.model ?? env.REALTIME_MODEL;

  const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'realtime=v1'
    },
    body: JSON.stringify({ model })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ServiceError('UPSTREAM_ERROR', 'Failed to create ephemeral token', {
      cause: new Error(errorText)
    });
  }

  const payload = (await response.json()) as {
    client_secret: {
      value: string;
      expires_at: number;
    };
  };

  const expiresIn = Math.max(0, Math.floor(payload.client_secret.expires_at - Date.now() / 1000));

  return {
    token: payload.client_secret.value,
    expiresIn
  };
}
