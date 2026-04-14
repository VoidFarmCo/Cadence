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
    price: 29,
    description: 'Up to 5 workers',
    features: ['5 workers', 'GPS time clock', 'Basic reporting', 'Tax forms'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    description: 'Up to 25 workers',
    features: ['25 workers', 'GPS time clock', 'Advanced reports', 'Payroll runs', 'Schedule management'],
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: 149,
    description: 'Unlimited workers',
    features: ['Unlimited workers', 'All Pro features', 'QuickBooks sync', 'Priority support', 'Custom exports'],
  },
];

export default function Billing() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null);

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
    setCheckoutLoading(plan.id);
    try {
      const res = await base44.functions.invoke('createCheckout', { plan_id: plan.id });
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

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div className="flex items-end gap-1">
                <span className="text-3xl font-bold">${plan.price}</span>
                <span className="text-sm text-muted-foreground mb-1">/mo</span>
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

      <p className="text-xs text-muted-foreground">
        All plans billed monthly. Cancel anytime. Payments secured by Stripe.
      </p>
    </div>
  );
}