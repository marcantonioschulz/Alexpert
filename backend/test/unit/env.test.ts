import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('env configuration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('parses defaults for optional variables', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai');
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/test');
    vi.stubEnv('API_KEY', 'unit-test-api-key-1234567890');
    vi.stubEnv('JWT_SECRET', 'unit-test-jwt-secret-12345678901234567890');

    const { env } = await import('../../src/lib/env.js');

    expect(env.APP_ENV).toBe('dev');
    expect(env.PORT).toBe(4000);
    expect(env.OPENAI_API_KEY).toBe('test-openai');
    expect(env.API_KEY).toBe('unit-test-api-key-1234567890');
    expect(env.JWT_SECRET).toBe('unit-test-jwt-secret-12345678901234567890');
  });

  it('throws when required env vars are missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('API_KEY', '');
    vi.stubEnv('JWT_SECRET', '');

    await expect(import('../../src/lib/env.js')).rejects.toThrowError(
      'Invalid environment configuration'
    );
  });
});
