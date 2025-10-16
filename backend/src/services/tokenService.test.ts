import { describe, expect, it, vi } from 'vitest';
import { createEphemeralToken } from './tokenService.js';

const baseEnv = {
  OPENAI_API_KEY: 'key',
  REALTIME_MODEL: 'gpt-realtime'
};

describe('tokenService', () => {
  it('creates a token using the provided model', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        client_secret: {
          value: 'token-value',
          expires_at: Math.floor(Date.now() / 1000) + 60
        }
      }),
      text: async () => ''
    });

    const result = await createEphemeralToken(
      {
        fetch: fetchMock as unknown as typeof fetch,
        env: baseEnv
      },
      { model: 'custom-model' }
    );

    expect(result.token).toBe('token-value');
    expect(result.expiresIn).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer key'
      }),
      body: JSON.stringify({ model: 'custom-model' })
    });
  });

  it('throws ServiceError when OpenAI request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => 'boom'
    });

    await expect(
      createEphemeralToken(
        {
          fetch: fetchMock as unknown as typeof fetch,
          env: baseEnv
        },
        {}
      )
    ).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
  });
});
