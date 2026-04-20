import prisma from '../lib/prisma';
import { sendTrialReminderEmail } from './email.service';

export async function processTrialReminders(): Promise<{
  reminded: number;
  locked: number;
}> {
  const trialAccounts = await prisma.account.findMany({
    where: { status: 'trial' },
  });

  let reminded = 0;
  let locked = 0;
  const now = new Date();

  for (const account of trialAccounts) {
    try {
      const trialEnd = new Date(account.trial_end);
      const diffMs = trialEnd.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Lock expired trials
      if (daysRemaining <= 0) {
        await prisma.account.update({
          where: { id: account.id },
          data: {
            status: 'locked',
            lock_reason: 'trial_expired',
          },
        });
        locked++;
        continue;
      }

      // Send 29-day reminder (1 day left) — check this first since it's more urgent
      if (daysRemaining <= 1 && !account.reminder_29_sent) {
        await sendTrialReminderEmail(account.owner_email, account.owner_name, daysRemaining);
        await prisma.account.update({
          where: { id: account.id },
          data: { reminder_29_sent: true },
        });
        reminded++;
      } else if (daysRemaining <= 5 && !account.reminder_25_sent) {
        // Send 25-day reminder (5 days left)
        await sendTrialReminderEmail(account.owner_email, account.owner_name, daysRemaining);
        await prisma.account.update({
          where: { id: account.id },
          data: { reminder_25_sent: true },
        });
        reminded++;
      }
    } catch (err) {
      console.error(`Failed to process trial for account ${account.id}:`, err);
    }
  }

  return { reminded, locked };
}
