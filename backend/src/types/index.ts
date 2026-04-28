import { UserRole, PlatformRole } from '@prisma/client';
import { Request } from 'express';
import { env } from '../config/env';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  platform_role: PlatformRole;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export const STRIPE_PRICE_IDS: Record<string, string> = {
  solo_month:         env.STRIPE_PRICE_SOLO_MONTH_ID,
  solo_year:          env.STRIPE_PRICE_SOLO_YEAR_ID,
  pro_month:          env.STRIPE_PRICE_PRO_MONTH_ID,
  pro_year:           env.STRIPE_PRICE_PRO_YEAR_ID,
  business_month:     env.STRIPE_PRICE_BUSINESS_MONTH_ID,
  business_year:      env.STRIPE_PRICE_BUSINESS_YEAR_ID,
  business_pro_month: env.STRIPE_PRICE_BUSINESS_PRO_MONTH_ID,
  business_pro_year:  env.STRIPE_PRICE_BUSINESS_PRO_YEAR_ID,
  enterprise_month:   env.STRIPE_PRICE_ENTERPRISE_MONTH_ID,
  enterprise_year:    env.STRIPE_PRICE_ENTERPRISE_YEAR_ID,
};

export const VALID_PRICE_IDS = new Set(Object.values(STRIPE_PRICE_IDS));

/** Safely extract a single string from req.query */
export function qs(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return undefined;
}
