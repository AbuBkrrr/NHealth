import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL URL'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('*'),
  PUBLIC_URL: z.string().url().optional(),
  APP_URL: z.string().default('https://www.nhealth.com.ng'),
  // Integrations - each feature switches on when its key is present.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('N-Health <no-reply@nhealth.com.ng>'),
  TERMII_API_KEY: z.string().optional(),
  TERMII_SENDER_ID: z.string().default('N-Health'),
  TERMII_BASE_URL: z.string().default('https://api.ng.termii.com'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_PUBLIC_KEY: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_HASH: z.string().optional(),
  FINCRA_SECRET_KEY: z.string().optional(),
  FINCRA_WEBHOOK_SECRET: z.string().optional(),
  MONNIFY_SECRET_KEY: z.string().optional(),
  DIDIT_API_KEY: z.string().optional(),
  DIDIT_WEBHOOK_SECRET: z.string().optional(),
  DIDIT_WORKFLOW_ID: z.string().optional(),
  DIDIT_PROVIDER_WORKFLOW_ID: z.string().optional(),
  DIDIT_BASE_URL: z.string().default('https://verification.didit.me'),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  SERVICE_FEE_PERCENT: z.coerce.number().default(5),
  POS_TAX_PERCENT: z.coerce.number().default(5),
  EMERGENCY_MIN_BALANCE: z.coerce.number().default(5000),
  SENTRY_DSN: z.string().optional(),
});

type RawEnv = z.infer<typeof envSchema>;

let cachedRaw: RawEnv | null = null;

function getRawEnv(): RawEnv {
  if (cachedRaw) return cachedRaw;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format());
    throw new Error('Environment validation failed');
  }
  cachedRaw = result.data;
  if (!cachedRaw.PUBLIC_URL) {
    cachedRaw.PUBLIC_URL = 'http://localhost:' + cachedRaw.PORT;
  }
  return cachedRaw;
}

export function getEnv() {
  const raw = getRawEnv();
  return {
    nodeEnv: raw.NODE_ENV,
    port: raw.PORT,
    databaseUrl: raw.DATABASE_URL,
    jwtSecret: raw.JWT_SECRET,
    jwtExpiresIn: raw.JWT_EXPIRES_IN,
    corsOrigin: raw.CORS_ORIGIN,
    publicUrl: raw.PUBLIC_URL!,
    appUrl: raw.APP_URL,
    raw,
    // Keep uppercase too for any code still using them
    NODE_ENV: raw.NODE_ENV,
    PORT: raw.PORT,
    DATABASE_URL: raw.DATABASE_URL,
    JWT_SECRET: raw.JWT_SECRET,
    JWT_EXPIRES_IN: raw.JWT_EXPIRES_IN,
    CORS_ORIGIN: raw.CORS_ORIGIN,
    PUBLIC_URL: raw.PUBLIC_URL!,
  };
}

export const env = getEnv();
export type Env = ReturnType<typeof getEnv>;
