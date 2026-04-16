import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { Accounts } from '@/api/entities';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const PLANS = [
  {
    id: 'solo',
    name: 'Solo',
    monthlyPrice: 12,
    annualPrice: 120,
    monthlyPriceId: 'price_1TMlgW2LZNrR2QMPfaYVOGfP',
    annualPriceId: 'price_1TMlgW2LZNrR2QMPBCdtBSQU',
    description: '1 user',
    features: ['1 user account', 'GPS time clock', 'Basic reporting', 'Tax forms'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 49,
    annualPrice: 490,
    monthlyPriceId: 'price_1TMlgX2LZNrR2QMPef24FoUJ',
    annualPriceId: 'price_1TMlgX2LZNrR2QMPC1K9aM7F',
    description: 'Up to 10 users',
    features: ['Everything in Solo', 'Team management', 'Payroll runs', 'Scheduling'],
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    monthlyPrice: 129,
    annualPrice: 1290,
    monthlyPriceId: 'price_1TMlgY2LZNrR2QMPYt0HdyYX',
    annualPriceId: 'price_1TMlgY2LZNrR2QMPMRvhqohb',
    description: 'Up to 25 users',
    features: ['Everything in Pro', 'Advanced analytics', 'Priority support'],
  },
  {
    id: 'business_pro',
    name: 'Business Pro',
    monthlyPrice: 300,
    annualPrice: 3000,
    monthlyPriceId: 'price_1TMlgZ2LZNrR2QMPnyeGAs48',
    annualPriceId: 'price_1TMlgZ2LZNrR2QMPO5ZzSbG5',
    description: 'Up to 50 users',
    features: ['Everything in Business', 'Custom integrations', 'Dedicated support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 500,
    annualPrice: 5000,
    monthlyPriceId: 'price_1TMlgZ2LZNrR2QMP54JCUuc4',
    annualPriceId: 'price_1TMlga2LZNrR2QMPu42QcNuy',
    description: 'Unlimited users',
    features: ['Everything in Business Pro', 'Unlimited users', 'Custom contract', 'Dedicated account manager'],
  },
];

export default function Billing() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [billingInterval, setBillingInterval] = useState('monthly');

  useEffect(() => {
    // Show feedback after Stripe redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('success')) {
      toast.success('Payment successful! Your plan will update shortly.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('cancelled')) {
      toast.info('Checkout cancelled.');
      window.history.replaceState({}, '', window.location.pathname);
    }

    async function load() {
      const me = await api.get('/api/auth/me').then(r => r.data);
      const accounts = await Accounts.list({ owner_email: me.email });
      setAccount(accounts[0] || null);
      setLoading(false);
    }
    load();
  }, []);

  async function handleUpgrade(plan) {
    setCheckoutLoading(plan.id);
    try {
      const priceId = billingInterval === 'monthly' ? plan.monthlyPriceId : plan.annualPriceId;
      const { data } = await api.post('/api/stripe/create-checkout', { price_id: priceId });
      if (!data.url) throw new Error('No checkout URL returned');
      window.location.href = data.url;
    } catch (err) {
      toast.error('Could not start checkout: ' + err.message);
    } finally {
      setCheckoutLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const currentPlan = account?.plan;
  const accountStatus = account?.status || 'trial';

  return (
    <div className="space-y-8 animate-slide-up max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">Billing & Plan</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your subscription and billing</p>
      </div>

      {/* Current Status */}
      <div className="bg-card rounded-xl border border-border p-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Current Plan</p>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">
              {currentPlan ? currentPlan : 'Free Trial'}
            </p>
          </div>
        </div>
        <Badge
          className={
            accountStatus === 'active'
              ? 'bg-success/10 text-success border-success/20'
              : accountStatus === 'trial'
              ? 'bg-warning/10 text-warning border-warning/20'
              : 'bg-destructive/10 text-destructive border-destructive/20'
          }
        >
          {accountStatus === 'trial' ? 'Trial' : accountStatus === 'active' ? 'Active' : accountStatus}
        </Badge>
      </div>

      {accountStatus === 'locked' && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">Account Locked</p>
            <p className="text-xs text-muted-foreground mt-1">
              {account?.lock_reason === 'trial_expired'
                ? 'Your trial has expired. Please upgrade to continue.'
                : 'Payment failed. Please update your billing to restore access.'}
            </p>
          </div>
        </div>
      )}

      {/* Billing Interval Toggle */}
      <div className="flex items-center justify-center gap-4 bg-card rounded-xl border border-border p-4">
        <button
          onClick={() => setBillingInterval('monthly')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            billingInterval === 'monthly'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Monthly
        </button>
        <div className="w-px h-6 bg-border" />
        <button
          onClick={() => setBillingInterval('annual')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
            billingInterval === 'annual'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Annual
          <Badge className="bg-success/10 text-success border-success/20 text-xs">Save 20%</Badge>
        </button>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={`relative bg-card rounded-xl border p-6 flex flex-col gap-4 ${
                plan.popular ? 'border-primary shadow-md' : 'border-border'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground text-xs px-3">Most Popular</Badge>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-base">{plan.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold">
                    ${billingInterval === 'monthly' ? plan.monthlyPrice : plan.annualPrice}
                  </span>
                  <span className="text-sm text-muted-foreground mb-1">
                    {billingInterval === 'monthly' ? '/mo' : '/yr'}
                  </span>
                </div>
                {billingInterval === 'annual' && (
                  <p className="text-xs text-success">
                    ${(plan.annualPrice / 12).toFixed(0)}/mo billed annually
                  </p>
                )}
              </div>
              <ul className="space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={isCurrent ? 'secondary' : plan.popular ? 'default' : 'outline'}
                disabled={isCurrent || checkoutLoading === plan.id}
                onClick={() => !isCurrent && handleUpgrade(plan)}
              >
                {checkoutLoading === plan.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCurrent ? (
                  'Current Plan'
                ) : (
                  'Upgrade'
                )}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border pt-6 mt-6 space-y-2">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">30-day free trial</strong> on all plans. Cancel anytime. Payments secured by Stripe.
        </p>
        <p className="text-xs text-muted-foreground">
          Save 20% when billed annually. Pricing shown is per user/month.
        </p>
      </div>
    </div>
  );
}
