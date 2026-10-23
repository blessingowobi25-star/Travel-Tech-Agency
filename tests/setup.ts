/**
 * Global test setup.
 *
 * Every test in this suite runs against an isolated in-memory SQLite database.
 * The environment is pinned here (before any module reads `process.env`) so
 * the app boots exactly the way it would in development, minus the external
 * services.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
delete process.env.DATABASE_URL;
process.env.SQLITE_FILE = ':memory:';
process.env.AUTH_PROVIDER = 'local';
process.env.AI_PROVIDER = 'fallback';
process.env.EMAIL_PROVIDER = 'console';
process.env.LOG_LEVEL = 'error';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.APP_URL = 'http://localhost:3000';
process.env.SESSION_TTL_HOURS = '72';

// The Paystack key is a test-mode placeholder. It lets the payment service
// believe it is configured so the code paths are exercised, but no request
// ever leaves the machine because `fetch` is stubbed per test.
process.env.PAYSTACK_SECRET_KEY = 'sk_test_0000000000000000000000000000000000000000';
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_0000000000000000000000000000000000000000';
process.env.PAYSTACK_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.PAYSTACK_API_BASE = 'https://api.paystack.test';
