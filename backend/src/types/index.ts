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
  solo_month: 'price_1TMGsDDPghjun5PixSQyO7gs',
  solo_year: 'price_1TMGsDDPghjun5Pizf7LFxjd',
  pro_month: 'price_1TMGsDDPghjun5Pi1KcCN4yt',
  pro_year: 'price_1TMGsDDPghjun5PiynXY1nGn',
  business_month: 'price_1TMGsDDPghjun5PiCFdTX8Wi',
  business_year: 'price_1TMGsDDPghjun5Pie9vyRaPb',
  business_pro_month: 'price_1TMGwDDPghjun5Pi7Q74Xy9U',
  business_pro_year: 'price_1TMGwDDPghjun5PiBFsszW9I',
};

export const VALID_PRICE_IDS = new Set(Object.values(STRIPE_PRICE_IDS));

/** Safely extract a single string from req.query */
export function qs(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return undefined;
}
