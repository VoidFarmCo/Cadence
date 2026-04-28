import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Treat empty-string env vars as unset so .default() fires. Railway and other
// PaaS UIs sometimes leave a key present but empty when the operator clears
// the input box.
const priceId = (fallback: string) =>
  z.preprocess((v) => (v === '' ? undefined : v), z.string().default(fallback));

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  // Stripe price IDs — deployment-specific. Defaults are the production
  // System Voidz Stripe account; override per environment to swap accounts
  // or test prices without a code change.
  STRIPE_PRICE_SOLO_MONTH_ID:         priceId('price_1TMNnrDPghjun5PiGhCRtxT6'),
  STRIPE_PRICE_SOLO_YEAR_ID:          priceId('price_1TMNnrDPghjun5Pifkhmi6ma'),
  STRIPE_PRICE_PRO_MONTH_ID:          priceId('price_1TMNnrDPghjun5PiMLZ0UpIO'),
  STRIPE_PRICE_PRO_YEAR_ID:           priceId('price_1TMNnrDPghjun5PiZDt9pkoW'),
  STRIPE_PRICE_BUSINESS_MONTH_ID:     priceId('price_1TR4qkDPghjun5PieuxOF7Ci'),
  STRIPE_PRICE_BUSINESS_YEAR_ID:      priceId('price_1TMNnrDPghjun5PishIEer7e'),
  STRIPE_PRICE_BUSINESS_PRO_MONTH_ID: priceId('price_1TMNnrDPghjun5Pie371V6lb'),
  STRIPE_PRICE_BUSINESS_PRO_YEAR_ID:  priceId('price_1TMNnrDPghjun5Pist2YtIMA'),
  STRIPE_PRICE_ENTERPRISE_MONTH_ID:   priceId('price_1TMNnrDPghjun5PiPnBAzOSS'),
  STRIPE_PRICE_ENTERPRISE_YEAR_ID:    priceId('price_1TMNnrDPghjun5PiYVdeMPu3'),
  RESEND_API_KEY: z.string().default(''),
  SMTP_FROM: z.string().default('noreply@mycadences.com'),
  APP_URL: z.string().default('https://mycadences.com'),
  ADMIN_EMAIL: z.string().default(''),
  SUPERADMIN_EMAIL: z.string().default(''),
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
});

export const env = envSchema.parse(process.env);
