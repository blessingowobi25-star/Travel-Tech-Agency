import { z } from 'zod';

/**
 * Environment validation.
 *
 * The app boots with ZERO external credentials so a founder can run and test it
 * immediately. Optional integrations degrade gracefully and report themselves as
 * "not configured" via /api/health - they never fake a successful result.
 */
const boolish = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // --- Database ---------------------------------------------------------
  // Leave empty to use the bundled local SQLite file (development only).
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: boolish,
  DATABASE_SSL_REJECT_UNAUTHORIZED: boolish,

  // --- App --------------------------------------------------------------
  APP_URL: z.string().default('http://localhost:3000'),
  APP_NAME: z.string().default('Waymark Travel'),

  // --- Auth -------------------------------------------------------------
  // "local" = built-in password auth (works offline). "supabase" = Supabase Auth.
  AUTH_PROVIDER: z.enum(['local', 'supabase']).default('local'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SESSION_SECRET: z.string().min(16).optional(),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(72),

  // --- AI provider ------------------------------------------------------
  // Any OpenAI-compatible chat-completions endpoint (OpenAI, Groq, OpenRouter).
  AI_PROVIDER: z.enum(['openai', 'fallback']).default('fallback'),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(1600),
  AI_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(20),

  // --- Payments (Paystack) ----------------------------------------------
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  PAYSTACK_API_BASE: z.string().default('https://api.paystack.co'),

  // --- Email ------------------------------------------------------------
  EMAIL_PROVIDER: z.enum(['smtp', 'console']).default('console'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: boolish,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default('Waymark Travel <no-reply@waymarktravel.example>'),
  EMAIL_FROM_NAME: z.string().default('Waymark Travel'),

  // --- Observability / abuse control ------------------------------------
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  RATE_LIMIT_ENABLED: z.string().default('true').transform((v) => v !== 'false'),

  // --- Admin ------------------------------------------------------------
  ADMIN_EMAILS: z.string().default(''),
});

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export type Env = z.infer<typeof schema> & { ADMIN_EMAIL_LIST: string[] };

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = { ...parsed.data, ADMIN_EMAIL_LIST: splitList(parsed.data.ADMIN_EMAILS) };
  return cached;
}

/** Test helper - forces a re-read of process.env. */
export function resetEnvCache() {
  cached = null;
}

export interface IntegrationStatus {
  name: string;
  configured: boolean;
  required: string[];
  missing: string[];
  note: string;
}



export function integrationStatuses(env: Env = getEnv()): IntegrationStatus[] {
  const aiMissing: string[] = [];
  if (env.AI_PROVIDER === 'openai' && !env.AI_API_KEY) aiMissing.push('AI_API_KEY');

  const paystackMissing: string[] = [];
  if (!env.PAYSTACK_SECRET_KEY) paystackMissing.push('PAYSTACK_SECRET_KEY');
  if (!env.PAYSTACK_PUBLIC_KEY) paystackMissing.push('PAYSTACK_PUBLIC_KEY');
  if (!env.PAYSTACK_WEBHOOK_SECRET) paystackMissing.push('PAYSTACK_WEBHOOK_SECRET');

  const emailMissing: string[] = [];
  if (env.EMAIL_PROVIDER === 'smtp') {
    if (!env.SMTP_HOST) emailMissing.push('SMTP_HOST');
    if (!env.SMTP_USER) emailMissing.push('SMTP_USER');
    if (!env.SMTP_PASSWORD) emailMissing.push('SMTP_PASSWORD');
  }

  const dbMissing = env.DATABASE_URL ? [] : ['DATABASE_URL'];

  return [
    {
      name: 'Database',
      configured: dbMissing.length === 0,
      required: ['DATABASE_URL'],
      missing: dbMissing,
      note:
        dbMissing.length === 0
          ? 'Connected to PostgreSQL.'
          : 'Using the bundled local SQLite database (development only). Set DATABASE_URL for Postgres/Supabase.',
    },
    {
      name: 'Authentication',
      configured:
        env.AUTH_PROVIDER === 'local' || Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY),
      required: ['AUTH_PROVIDER'],
      missing:
        env.AUTH_PROVIDER === 'supabase' && !(env.SUPABASE_URL && env.SUPABASE_ANON_KEY)
          ? ['SUPABASE_URL', 'SUPABASE_ANON_KEY']
          : [],
      note:
        env.AUTH_PROVIDER === 'supabase'
          ? 'Using Supabase Auth.'
          : 'Using the built-in local password provider.',
    },
    {
      name: 'AI provider',
      configured: aiMissing.length === 0,
      required: ['AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL'],
      missing: aiMissing,
      note:
        env.AI_PROVIDER === 'fallback'
          ? 'Using the clearly-labelled rule-based development fallback (not a real LLM).'
          : aiMissing.length === 0
            ? `Connected to ${env.AI_BASE_URL} (${env.AI_MODEL}).`
            : 'AI provider is selected but incomplete. Recommendations fall back to the rule-based engine.',
    },
    {
      name: 'Payments (Paystack)',
      configured: paystackMissing.length === 0,
      required: ['PAYSTACK_SECRET_KEY', 'PAYSTACK_PUBLIC_KEY', 'PAYSTACK_WEBHOOK_SECRET'],
      missing: paystackMissing,
      note:
        paystackMissing.length === 0
          ? 'Paystack test-mode integration is active.'
          : 'Paystack is not configured. Orders cannot be paid and will stay AWAITING_PAYMENT.',
    },
    {
      name: 'Email',
      configured: emailMissing.length === 0,
      required: ['EMAIL_PROVIDER'],
      missing: emailMissing,
      note:
        env.EMAIL_PROVIDER === 'console'
          ? 'Email runs in development mode: messages are logged, not delivered.'
          : emailMissing.length === 0
            ? 'SMTP email delivery is active.'
            : 'SMTP is selected but incomplete; emails fall back to development logging.',
    },
  ];
}
