import { Router, Request, Response } from 'express';
import { z } from 'zod';
import stripeClient from '../lib/stripe';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { env } from '../config/env';
import { AuthRequest, VALID_PRICE_IDS, STRIPE_PRICE_IDS } from '../types';
import { createAuditLog } from '../services/audit.service';
import { sendEmail } from '../services/email.service';
import { getIO } from '../lib/socket';

const router = Router();

// ─── Create Checkout Session ────────────────────────────────────────────────

const checkoutSchema = z.object({
  price_id: z.string().min(1),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
});

router.post(
  '/create-checkout',
  authenticate,
  requireRole('owner'),
  validate(checkoutSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { price_id, success_url, cancel_url } = req.body;

      if (!VALID_PRICE_IDS.has(price_id)) {
        res.status(400).json({ error: 'Invalid price ID' });
        return;
      }

      const account = await prisma.account.findFirst({
        where: { owner_email: req.user!.email },
      });
      if (!account) {
        res.status(404).json({ error: 'Account not found' });
        return;
      }

      const sessionParams: any = {
        mode: 'subscription',
        line_items: [{ price: price_id, quantity: 1 }],
        success_url: success_url || `${env.APP_URL}/settings/billing?success=true`,
        cancel_url: cancel_url || `${env.APP_URL}/settings/billing?canceled=true`,
        metadata: {
          account_id: account.id,
          owner_email: req.user!.email,
        },
      };

      // Use existing customer if we have one
      if (account.stripe_customer_id) {
        sessionParams.customer = account.stripe_customer_id;
      } else {
        sessionParams.customer_email = req.user!.email;
      }

      const session = await stripeClient.checkout.sessions.create(sessionParams);

      res.json({ url: session.url });
    } catch (error) {
      console.error('Stripe checkout error:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  }
);

// ─── Stripe Webhooks ────────────────────────────────────────────────────────

router.post(
  '/webhook',
  // Raw body is needed for webhook signature verification
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    if (!sig) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    let event;
    try {
      event = stripeClient.webhooks.constructEvent(
        req.body,
        sig,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      res.status(400).json({ error: 'Webhook signature verification failed' });
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as any;
          const accountId = session.metadata?.account_id;
          const ownerEmail = session.metadata?.owner_email;

          if (accountId) {
            // Build plan and interval mappings from canonical price IDs
            const planMapping: Record<string, string> = {
              [STRIPE_PRICE_IDS.solo_month]:         'solo',
              [STRIPE_PRICE_IDS.solo_year]:          'solo',
              [STRIPE_PRICE_IDS.pro_month]:          'pro',
              [STRIPE_PRICE_IDS.pro_year]:           'pro',
              [STRIPE_PRICE_IDS.business_month]:     'business',
              [STRIPE_PRICE_IDS.business_year]:      'business',
              [STRIPE_PRICE_IDS.business_pro_month]: 'business_pro',
              [STRIPE_PRICE_IDS.business_pro_year]:  'business_pro',
              [STRIPE_PRICE_IDS.enterprise_month]:   'enterprise',
              [STRIPE_PRICE_IDS.enterprise_year]:    'enterprise',
            };

            const intervalMapping: Record<string, string> = {
              [STRIPE_PRICE_IDS.solo_month]:         'month',
              [STRIPE_PRICE_IDS.solo_year]:          'year',
              [STRIPE_PRICE_IDS.pro_month]:          'month',
              [STRIPE_PRICE_IDS.pro_year]:           'year',
              [STRIPE_PRICE_IDS.business_month]:     'month',
              [STRIPE_PRICE_IDS.business_year]:      'year',
              [STRIPE_PRICE_IDS.business_pro_month]: 'month',
              [STRIPE_PRICE_IDS.business_pro_year]:  'year',
              [STRIPE_PRICE_IDS.enterprise_month]:   'month',
              [STRIPE_PRICE_IDS.enterprise_year]:    'year',
            };

            // Fetch the subscription to get the price ID
            let priceId = '';
            if (session.subscription) {
              const subscription = await stripeClient.subscriptions.retrieve(session.subscription);
              priceId = subscription.items.data[0]?.price?.id || '';
            }

            const plan = planMapping[priceId] || 'solo';
            const billingInterval = intervalMapping[priceId] || 'month';

            await prisma.account.update({
              where: { id: accountId },
              data: {
                status: 'active',
                plan: plan as any,
                billing_interval: billingInterval as any,
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: session.subscription as string,
                stripe_subscription_status: 'active',
                lock_reason: null,
              },
            });
            try { getIO().emit('account:updated', { id: accountId }); } catch {}
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as any;
          await prisma.account.updateMany({
            where: { stripe_subscription_id: subscription.id },
            data: {
              stripe_subscription_status: subscription.status,
              ...(subscription.status === 'active' ? { status: 'active' } : {}),
              ...(subscription.status === 'past_due' || subscription.status === 'unpaid' ? { status: 'locked', lock_reason: 'payment_failed' } : {}),
            },
          });
          try { getIO().emit('account:updated', { subscription_id: subscription.id }); } catch {}
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as any;
          await prisma.account.updateMany({
            where: { stripe_subscription_id: subscription.id },
            data: {
              status: 'cancelled',
              stripe_subscription_status: 'canceled',
            },
          });
          try { getIO().emit('account:updated', { subscription_id: subscription.id }); } catch {}
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as any;
          if (invoice.subscription) {
            const account = await prisma.account.findFirst({
              where: { stripe_subscription_id: invoice.subscription },
            });
            if (account) {
              await prisma.account.update({
                where: { id: account.id },
                data: { status: 'locked', lock_reason: 'payment_failed' },
              });
              try { getIO().emit('account:updated', { id: account.id }); } catch {}
              try {
                await sendEmail(
                  account.owner_email,
                  'Action required: Payment failed for Cadence',
                  `<h2>Your Cadence payment failed</h2>
                <p>Hi ${account.owner_name},</p>
                <p>We were unable to process your payment. Your account has been locked.</p>
                <p>Please update your billing information to restore access:</p>
                <p><a href="${env.APP_URL}/billing" style="padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;">Update Billing</a></p>`
                );
              } catch (emailErr) {
                console.error('Failed to send payment failure email:', emailErr);
              }
            }
          }
          break;
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

// ─── Get billing portal URL ─────────────────────────────────────────────────

router.post(
  '/billing-portal',
  authenticate,
  requireRole('owner'),
  async (req: AuthRequest, res: Response) => {
    try {
      const account = await prisma.account.findFirst({
        where: { owner_email: req.user!.email },
      });

      if (!account?.stripe_customer_id) {
        res.status(400).json({ error: 'No Stripe customer found' });
        return;
      }

      const session = await stripeClient.billingPortal.sessions.create({
        customer: account.stripe_customer_id,
        return_url: `${env.APP_URL}/settings/billing`,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error('Billing portal error:', error);
      res.status(500).json({ error: 'Failed to create billing portal session' });
    }
  }
);

export default router;
