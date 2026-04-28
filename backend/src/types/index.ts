import { UserRole, PlatformRole } from '@prisma/client';
import { Request } from 'express';

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
  solo_month:         'price_1TMNnrDPghjun5PiGhCRtxT6',
  solo_year:          'price_1TMNnrDPghjun5Pifkhmi6ma',
  pro_month:          'price_1TMNnrDPghjun5PiMLZ0UpIO',
  pro_year:           'price_1TMNnrDPghjun5PiZDt9pkoW',
  business_month:     'price_1TR4qkDPghjun5PieuxOF7Ci',
  business_year:      'price_1TMNnrDPghjun5PishIEer7e',
  business_pro_month: 'price_1TMNnrDPghjun5Pie371V6lb',
  business_pro_year:  'price_1TMNnrDPghjun5Pist2YtIMA',
  enterprise_month:   'price_1TMNnrDPghjun5PiPnBAzOSS',
  enterprise_year:    'price_1TMNnrDPghjun5PiYVdeMPu3',
};

export const VALID_PRICE_IDS = new Set(Object.values(STRIPE_PRICE_IDS));

/** Safely extract a single string from req.query */
export function qs(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return undefined;
}
