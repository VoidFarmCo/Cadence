import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

// Valid live price IDs
const VALID_PRICE_IDS = new Set([
  'price_1TMGsDDPghjun5PixSQyO7gs', // Solo monthly
  'price_1TMGsDDPghjun5Pizf7LFxjd', // Solo annual
  'price_1TMGsDDPghjun5Pi1KcCN4yt', // Pro monthly
  'price_1TMGsDDPghjun5PiynXY1nGn', // Pro annual
  'price_1TMGsDDPghjun5PiCFdTX8Wi', // Business monthly
  'price_1TMGsDDPghjun5Pie9vyRaPb', // Business annual
  'price_1TMGsDDPghjun5PibOla4drH', // Enterprise monthly
  'price_1TMGsDDPghjun5PiuZZy6DoF', // Enterprise annual
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { price_id, plan_id } = await req.json();
    const priceId = price_id;
    if (!priceId || !VALID_PRICE_IDS.has(priceId)) return Response.json({ error: 'Invalid price' }, { status: 400 });

    const appUrl = req.headers.get('origin') || 'https://app.base44.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      success_url: `${appUrl}/billing?success=1`,
      cancel_url: `${appUrl}/billing?cancelled=1`,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        plan_id: plan_id || price_id,
        owner_email: user.email,
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});