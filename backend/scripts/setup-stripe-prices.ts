/**
 * One-time script to create Stripe products and prices.
 * Run with: STRIPE_SECRET_KEY=sk_live_xxx npx tsx scripts/setup-stripe-prices.ts
 */
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' as any });

const plans = [
  { id: 'solo',         name: 'Solo',         monthly: 1200,  annual: 12000  },
  { id: 'pro',          name: 'Pro',           monthly: 4900,  annual: 49000  },
  { id: 'business',     name: 'Business',      monthly: 12900, annual: 129000 },
  { id: 'business_pro', name: 'Business Pro',  monthly: 30000, annual: 300000 },
  { id: 'enterprise',   name: 'Enterprise',    monthly: 50000, annual: 500000 },
];

async function main() {
  const ids: Record<string, string> = {};

  for (const plan of plans) {
    const product = await stripe.products.create({
      name: `Cadence ${plan.name}`,
      metadata: { plan: plan.id },
    });

    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      unit_amount: plan.monthly,
      recurring: { interval: 'month' },
      metadata: { plan: plan.id, interval: 'month' },
    });

    const annualPrice = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      unit_amount: plan.annual,
      recurring: { interval: 'year' },
      metadata: { plan: plan.id, interval: 'year' },
    });

    ids[`${plan.id}_month`] = monthlyPrice.id;
    ids[`${plan.id}_year`] = annualPrice.id;

    console.log(`✓ ${plan.name}: month=${monthlyPrice.id}  year=${annualPrice.id}`);
  }

  console.log('\n--- Copy these into backend/src/types/index.ts ---');
  console.log(JSON.stringify(ids, null, 2));
}

main().catch(console.error);
