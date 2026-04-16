import nodemailer from 'nodemailer';
import { env } from '../config/env';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: parseInt(env.SMTP_PORT, 10),
      secure: parseInt(env.SMTP_PORT, 10) === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string
): Promise<void> {
  const transport = getTransporter();
  await transport.sendMail({
    from: env.SMTP_FROM,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
  });
}

export async function sendInviteEmail(
  email: string,
  fullName: string,
  inviteToken: string
): Promise<void> {
  const inviteUrl = `${env.APP_URL}/accept-invite?token=${inviteToken}`;
  const html = `
    <h2>You've been invited to Cadence</h2>
    <p>Hi ${fullName},</p>
    <p>You've been invited to join your team on Cadence, a workforce management platform.</p>
    <p>Click the link below to set up your account:</p>
    <p><a href="${inviteUrl}" style="padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Accept Invite</a></p>
    <p>Or copy this link: ${inviteUrl}</p>
    <p>This invite will expire in 7 days.</p>
  `;
  await sendEmail(email, 'You\'re invited to Cadence', html);
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
