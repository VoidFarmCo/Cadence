import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

Deno.serve(async (req) => {
  // Initialize Base44 client first for proper context
  const base44 = createClientFromRequest(req);

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const ownerEmail = session.metadata?.owner_email;
      const rawPlanId = session.metadata?.plan_id;
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      // Normalize: if plan_id looks like a price ID, map it to a plan name
      const PRICE_TO_PLAN = {
        'price_1TMGsDDPghjun5PixSQyO7gs': 'solo',
        'price_1TMGsDDPghjun5Pizf7LFxjd': 'solo',
        'price_1TMGsDDPghjun5Pi1KcCN4yt': 'pro',
        'price_1TMGsDDPghjun5PiynXY1nGn': 'pro',
        'price_1TMGsDDPghjun5PiCFdTX8Wi': 'business',
        'price_1TMGsDDPghjun5Pie9vyRaPb': 'business',
        'price_1TMGwDDPghjun5Pi7Q74Xy9U': 'business-pro',
        'price_1TMGwDDPghjun5PiBFsszW9I': 'business-pro',
      };
      const planId = PRICE_TO_PLAN[rawPlanId] || rawPlanId;

      if (!ownerEmail || !planId) {
        console.error('Missing metadata in session:', session.id);
        return Response.json({ received: true });
      }

      const accounts = await base44.asServiceRole.entities.Account.filter({ owner_email: ownerEmail });
      if (accounts.length > 0) {
        await base44.asServiceRole.entities.Account.update(accounts[0].id, {
          plan: planId,
          status: 'active',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_subscription_status: 'active',
        });
        console.log(`Account updated for ${ownerEmail} → plan: ${planId}`);
      } else {
        console.error('No account found for email:', ownerEmail);
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      const accounts = await base44.asServiceRole.entities.Account.filter({ stripe_customer_id: sub.customer });
      if (accounts.length > 0) {
        await base44.asServiceRole.entities.Account.update(accounts[0].id, {
          stripe_subscription_status: sub.status,
          status: sub.status === 'active' ? 'active' : 'locked',
        });
        console.log(`Subscription updated for customer ${sub.customer} → status: ${sub.status}`);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const accounts = await base44.asServiceRole.entities.Account.filter({ stripe_customer_id: sub.customer });
      if (accounts.length > 0) {
        await base44.asServiceRole.entities.Account.update(accounts[0].id, {
          stripe_subscription_status: 'cancelled',
          status: 'cancelled',
        });
        console.log(`Subscription cancelled for customer ${sub.customer}`);
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const accounts = await base44.asServiceRole.entities.Account.filter({ stripe_customer_id: invoice.customer });
      if (accounts.length > 0) {
        await base44.asServiceRole.entities.Account.update(accounts[0].id, {
          status: 'locked',
          lock_reason: 'payment_failed',
        });
        console.log(`Payment failed for customer ${invoice.customer}`);
      }
    }

  } catch (err) {
    console.error('Webhook handler error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }

  return Response.json({ received: true });
});