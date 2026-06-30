import { z } from 'zod';

const envSchema = z.object({
  // Database — runtime pooler (required)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Database — direct connection for migrations (optional; falls back to DATABASE_URL in drizzle.config)
  DIRECT_DATABASE_URL: z.string().optional(),

  // Clerk authentication
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  // Value is the Clerk webhook Signing Secret (whsec_...)
  CLERK_WEBHOOK_SECRET: z.string().min(1),

  // Cloudflare Stream (optional until the video-pipeline change wires it)
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),

  // AI (optional until the ai-tutor-rag change wires it)
  ANTHROPIC_API_KEY: z.string().optional(),
  VOYAGE_API_KEY: z.string().optional(),

  // Supabase client SDK (OPTIONAL — not used at runtime; reserved for future Storage)
  SUPABASE_URL: z.string().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration — check .env.example');
  }
  return result.data;
}

// Export a lazy-loaded singleton so the module can be imported without
// throwing at import time during build (Next.js evaluates all route modules).
let _env: Env | undefined;

export function getEnv(): Env {
  if (!_env) {
    _env = parseEnv();
  }
  return _env;
}

// Named export for direct destructuring at call sites:
// import { env } from '@/config/env';
export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});
