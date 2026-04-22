import { Resend } from 'resend';
import { env } from '../config/env';

let resend: Resend | null = null;

function getResend(): Resend {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set. Configure it in the backend environment.');
  }
  if (!resend) {
    resend = new Resend(env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string
): Promise<void> {
  const { error } = await getResend().emails.send({
    from: env.SMTP_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  });
  if (error) {
    throw new Error(error.message || 'Resend API returned an error');
  }
}

export function buildInviteUrl(inviteToken: string): string {
  return `${env.APP_URL}/accept-invite?token=${inviteToken}`;
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
): Promise<void> {
  const resetUrl = `${env.APP_URL}/reset-password?token=${resetToken}`;
  const html = `
    <h2>Password Reset Request</h2>
    <p>A password reset was requested for your Cadence account.</p>
    <p>Click the link below to reset your password:</p>
    <p><a href="${resetUrl}" style="padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
    <p>Or copy this link: ${resetUrl}</p>
    <p>This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
  `;
  await sendEmail(email, 'Cadence Password Reset', html);
}

export async function sendTrialReminderEmail(
  email: string,
  ownerName: string,
  daysRemaining: number
): Promise<void> {
  const upgradeUrl = `${env.APP_URL}/settings/billing`;
  const html = `
    <h2>Your Cadence trial is ending soon</h2>
    <p>Hi ${ownerName},</p>
    <p>Your free trial expires in <strong>${daysRemaining} days</strong>.</p>
    <p>Upgrade now to keep access to all features:</p>
    <p><a href="${upgradeUrl}" style="padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Upgrade Now</a></p>
    <p>Questions? Reply to this email — we're happy to help.</p>
  `;
  await sendEmail(email, `Your Cadence trial ends in ${daysRemaining} days`, html);
}
