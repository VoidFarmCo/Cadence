import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const PLANS = [
  {
    id: 'solo',
    name: 'Solo',
    monthlyPrice: 29,
    annualPrice: 299,
    monthlyPriceId: 'price_1TMGsDDPghjun5PixSQyO7gs',
    annualPriceId: 'price_1TMGsDDPghjun5Pizf7LFxjd',
    description: '1 user',
    features: ['1 user account', 'GPS time clock', 'Basic reporting', 'Tax forms'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 79,
    annualPrice: 799,
    monthlyPriceId: 'price_1TMGsDDPghjun5Pi1KcCN4yt',
    annualPriceId: 'price_1TMGsDDPghjun5PiynXY1nGn',
    description: 'Up to 5 users',
    features: ['5 user accounts', 'GPS time clock', 'Advanced reports', 'Payroll runs', 'Schedule management'],
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    monthlyPrice: 199,
    annualPrice: 1999,
    monthlyPriceId: 'price_1TMGsDDPghjun5PiCFdTX8Wi',
    annualPriceId: 'price_1TMGsDDPghjun5Pie9vyRaPb',
    description: 'Up to 20 users',
    features: ['20 user accounts', 'All Pro features', 'Check.hq integration', 'Priority support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 499,
    annualPrice: 4999,
    monthlyPriceId: 'price_1TMGsDDPghjun5PibOla4drH',
    annualPriceId: 'price_1TMGsDDPghjun5PiuZZy6DoF',
    description: 'Unlimited users',
    features: ['Unlimited user accounts', 'All Business features', 'Custom integrations', 'Dedicated account manager'],
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
      const me = await base44.auth.me();
      const accounts = await base44.entities.Account.filter({ owner_email: me.email });
      setAccount(accounts[0] || null);
      setLoading(false);
    }
    load();
  }, []);

  async function handleUpgrade(plan) {
    if (plan.enterprise) {
      window.location.href = 'mailto:sales@example.com?subject=Enterprise%20Plan%20Inquiry';
      return;
    }
    
    setCheckoutLoading(plan.id);
    try {
      const priceId = billingInterval === 'monthly' ? plan.monthlyPriceId : plan.annualPriceId;
      const res = await base44.functions.invoke('createCheckout', { price_id: priceId, plan_id: plan.id });
      const url = res.data?.url;
      if (!url) throw new Error('No checkout URL returned');

      // Check if running in iframe
      if (window.self !== window.top) {
        alert('Checkout only works from the published app. Please open the app directly to upgrade.');
        return;
      }
      window.location.href = url;
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
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors relative ${
            billingInterval === 'annual'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Annual
          <Badge className="absolute -top-2 -right-8 bg-success/10 text-success border-success/20 text-xs">Save 20%</Badge>
        </button>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
              {!plan.enterprise && (
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold">
                    ${billingInterval === 'monthly' ? plan.monthlyPrice : (plan.annualPrice / 12).toFixed(2)}
                  </span>
                  <span className="text-sm text-muted-foreground mb-1">/{billingInterval === 'monthly' ? 'mo' : 'mo'}</span>
                </div>
              )}
              {plan.enterprise && (
                <div className="text-sm text-muted-foreground font-medium">Contact Sales</div>
              )}
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
                ) : plan.enterprise ? (
                  'Contact Sales'
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