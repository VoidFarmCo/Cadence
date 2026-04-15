import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all accounts in trial
    const accounts = await base44.asServiceRole.entities.Account.filter({
      status: 'trial'
    });

    const today = new Date();
    const results = [];

    for (const account of accounts) {
      if (!account.trial_start) continue;

      const trialStart = new Date(account.trial_start);
      const daysInTrial = Math.floor((today - trialStart) / (1000 * 60 * 60 * 24));

      // Send day 25 reminder
      if (daysInTrial === 25 && !account.reminder_25_sent) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: account.owner_email,
          subject: 'Your Cadence trial ends in 5 days',
          body: `Hi ${account.owner_name || 'there'},\n\nYour 30-day free trial of Cadence ends in 5 days. Choose a plan to continue using Cadence after your trial ends.\n\nVisit your billing page to upgrade: https://cadence.app/billing\n\nBest regards,\nCadence Team`
        });

        await base44.asServiceRole.entities.Account.update(account.id, {
          reminder_25_sent: true
        });

        results.push({
          account: account.id,
          email: account.owner_email,
          reminder: 'day_25',
          sent: true
        });
      }

      // Send day 29 reminder
      if (daysInTrial === 29 && !account.reminder_29_sent) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: account.owner_email,
          subject: 'Your Cadence trial expires tomorrow',
          body: `Hi ${account.owner_name || 'there'},\n\nYour 30-day free trial of Cadence expires tomorrow. Please choose a plan to continue using Cadence.\n\nUpgrade now: https://cadence.app/billing\n\nBest regards,\nCadence Team`
        });

        await base44.asServiceRole.entities.Account.update(account.id, {
          reminder_29_sent: true
        });

        results.push({
          account: account.id,
          email: account.owner_email,
          reminder: 'day_29',
          sent: true
        });
      }
    }

    return Response.json({
      success: true,
      reminders_sent: results.length,
      results
    });
  } catch (error) {
    console.error('Trial reminders error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});