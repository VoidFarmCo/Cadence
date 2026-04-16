import { Router, Request, Response } from 'express';
import { z } from 'zod';
import stripeClient from '../lib/stripe';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { env } from '../config/env';
import { AuthRequest, VALID_PRICE_IDS } from '../types';
import { createAuditLog } from '../services/audit.service';

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
            // Determine plan from the subscription
            const planMapping: Record<string, string> = {
              'price_1TMGsDDPghjun5PixSQyO7gs': 'solo',
              'price_1TMGsDDPghjun5Pizf7LFxjd': 'solo',
              'price_1TMGsDDPghjun5Pi1KcCN4yt': 'pro',
              'price_1TMGsDDPghjun5PiynXY1nGn': 'pro',
              'price_1TMGsDDPghjun5PiCFdTX8Wi': 'business',
              'price_1TMGsDDPghjun5Pie9vyRaPb': 'business',
              'price_1TMGwDDPghjun5Pi7Q74Xy9U': 'enterprise',
              'price_1TMGwDDPghjun5PiBFsszW9I': 'enterprise',
            };

            const intervalMapping: Record<string, string> = {
              'price_1TMGsDDPghjun5PixSQyO7gs': 'month',
              'price_1TMGsDDPghjun5Pizf7LFxjd': 'year',
              'price_1TMGsDDPghjun5Pi1KcCN4yt': 'month',
              'price_1TMGsDDPghjun5PiynXY1nGn': 'year',
              'price_1TMGsDDPghjun5PiCFdTX8Wi': 'month',
              'price_1TMGsDDPghjun5Pie9vyRaPb': 'year',
              'price_1TMGwDDPghjun5Pi7Q74Xy9U': 'month',
              'price_1TMGwDDPghjun5PiBFsszW9I': 'year',
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
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as any;
          await prisma.account.updateMany({
            where: { stripe_subscription_id: subscription.id },
            data: {
              stripe_subscription_status: subscription.status,
              status: subscription.status === 'active' ? 'active' : undefined,
            },
          });
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
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as any;
          if (invoice.subscription) {
            await prisma.account.updateMany({
              where: { stripe_subscription_id: invoice.subscription },
              data: {
                status: 'locked',
                lock_reason: 'payment_failed',
              },
            });
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
