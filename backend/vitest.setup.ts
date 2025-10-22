// Test environment setup
// This file sets required environment variables for tests

process.env.NODE_ENV = 'test';
process.env.APP_ENV = 'dev';
process.env.PORT = '4000';

// Required security credentials (strong enough for validation)
process.env.API_KEY = 'test-api-key-1234567890';
process.env.JWT_SECRET = 'test-jwt-secret-12345678901234567890123456789012';

// Required OpenAI credentials (dummy for tests)
process.env.OPENAI_API_KEY = 'sk-test-key';

// Database URL (will be overridden by testcontainers in integration tests)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';

// Models
process.env.REALTIME_MODEL = 'gpt-4o-realtime-preview';
process.env.RESPONSES_MODEL = 'gpt-4o-mini';

// CORS
process.env.CORS_ORIGIN = '*';
