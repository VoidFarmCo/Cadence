import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

const PRICE_IDS = {
  solo:     'price_1TLvR1Deftkn5UiBkNmcWVxQ',
  pro:      'price_1TLvR1Deftkn5UiBKpsXvv9A',
  business: 'price_1TLvR1Deftkn5UiBwQAALEyx',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { plan_id } = await req.json();
    const priceId = PRICE_IDS[plan_id];
    if (!priceId) return Response.json({ error: 'Invalid plan' }, { status: 400 });

    const appUrl = req.headers.get('origin') || 'https://app.base44.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      success_url: `${appUrl}/billing?success=1`,
      cancel_url: `${appUrl}/billing?cancelled=1`,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        plan_id,
        owner_email: user.email,
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});