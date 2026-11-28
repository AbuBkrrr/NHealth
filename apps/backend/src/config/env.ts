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
  // WhatsApp Business (Meta Cloud API). N-Health sends no SMS: messages go in-app, by email and on WhatsApp.
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_TEMPLATE_OTP: z.string().default('nhealth_code'),
  WHATSAPP_TEMPLATE_UPDATE: z.string().default('nhealth_update'),
  WHATSAPP_TEMPLATE_NEWS: z.string().default('nhealth_news'),
  WHATSAPP_TEMPLATE_LANG: z.string().default('en'),
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
  // Coins are free rewards only. Selling coins (top-ups) is stored value and needs a CBN licence or licensed partner:
  // leave this off unless you have one.
  COIN_TOPUP_ENABLED: z.enum(['true', 'false']).default('false'),
  // Shown on the privacy policy and terms (NDPA 2023 requires the data controller's identity and DPO contact).
  COMPANY_LEGAL_NAME: z.string().default('N-Health'),
  COMPANY_RC_NUMBER: z.string().optional(),
  COMPANY_ADDRESS: z.string().optional(),
  DPO_EMAIL: z.string().default('privacy@nhealth.com.ng'),
  SUPPORT_EMAIL: z.string().default('support@nhealth.com.ng'),
  SUPPORT_WHATSAPP: z.string().optional(), // e.g. 2348012345678 - shows "WhatsApp us" in the help bubble
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
