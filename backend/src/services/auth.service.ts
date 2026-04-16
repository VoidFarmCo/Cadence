import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import prisma from '../lib/prisma';
import { JwtPayload } from '../types';
import { UserRole } from '@prisma/client';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function registerOwner(
  email: string,
  password: string,
  fullName: string,
  companyName: string
) {
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      password_hash: passwordHash,
      full_name: fullName,
      role: UserRole.owner,
      status: 'active',
    },
  });

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 30);

  const account = await prisma.account.create({
    data: {
      owner_email: email,
      owner_name: fullName,
      status: 'trial',
      plan: 'solo',
      trial_end: trialEnd,
    },
  });

  const company = await prisma.company.create({
    data: {
      name: companyName,
    },
  });

  await prisma.workerProfile.create({
    data: {
      user_email: email,
      full_name: fullName,
      role: UserRole.owner,
      status: 'active',
      worker_type: 'employee',
      company_id: company.id,
    },
  });

  return { user, account, company };
}

export async function createInvitedUser(
  email: string,
  fullName: string,
  role: UserRole,
  invitedByEmail: string,
  companyId: string | null
) {
  const inviteToken = generateInviteToken();

  const user = await prisma.user.create({
    data: {
      email,
      password_hash: '',
      full_name: fullName,
      role,
      status: 'pending',
      invite_token: inviteToken,
    },
  });

  await prisma.workerProfile.create({
    data: {
      user_email: email,
      full_name: fullName,
      role,
      status: 'pending',
      company_id: companyId,
    },
  });

  return { user, inviteToken };
}

export async function acceptInvite(token: string, password: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const user = await prisma.user.findFirst({
    where: {
      invite_token: token,
      status: 'pending',
      created_at: { gt: sevenDaysAgo },
    },
  });

  if (!user) {
    throw new Error('Invalid or expired invite token');
  }

  const passwordHash = await hashPassword(password);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash: passwordHash,
      status: 'active',
      invite_token: null,
    },
  });

  await prisma.workerProfile.updateMany({
    where: { user_email: user.email, status: 'pending' },
    data: { status: 'active' },
  });

  return updatedUser;
}
