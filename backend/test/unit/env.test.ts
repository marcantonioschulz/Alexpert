import { describe, expect, it, vi } from 'vitest';

describe('env configuration', () => {
  it('parses defaults for optional variables', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai');
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/test');
    vi.stubEnv('JWT_SECRET', 'unit-secret');

    const { env } = await import('../../src/lib/env.js');

    expect(env.APP_ENV).toBe('dev');
    expect(env.PORT).toBe(4000);
    expect(env.OPENAI_API_KEY).toBe('test-openai');
    expect(env.JWT_SECRET).toBe('unit-secret');
  });

  it('throws when required env vars are missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('JWT_SECRET', '');

    await expect(import('../../src/lib/env.js')).rejects.toThrowError(
      'Invalid environment configuration'
    );
  });
});
