import { UserRole } from '@prisma/client';
import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
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
  solo_month:         'price_1TMlgW2LZNrR2QMPfaYVOGfP',
  solo_year:          'price_1TMlgW2LZNrR2QMPBCdtBSQU',
  pro_month:          'price_1TMlgX2LZNrR2QMPef24FoUJ',
  pro_year:           'price_1TMlgX2LZNrR2QMPC1K9aM7F',
  business_month:     'price_1TMlgY2LZNrR2QMPYt0HdyYX',
  business_year:      'price_1TMlgY2LZNrR2QMPMRvhqohb',
  business_pro_month: 'price_1TMlgZ2LZNrR2QMPnyeGAs48',
  business_pro_year:  'price_1TMlgZ2LZNrR2QMPO5ZzSbG5',
  enterprise_month:   'price_1TMlgZ2LZNrR2QMP54JCUuc4',
  enterprise_year:    'price_1TMlga2LZNrR2QMPu42QcNuy',
};

export const VALID_PRICE_IDS = new Set(Object.values(STRIPE_PRICE_IDS));

/** Safely extract a single string from req.query */
export function qs(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return undefined;
}
