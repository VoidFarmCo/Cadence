import { useState } from 'react';
import { CheckCircle2, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/api/apiClient';
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
    features: ['GPS time clock', 'Basic reporting', 'Tax forms'],
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

export default function Paywall({ lockReason }) {
  const [billing, setBilling] = useState('monthly');
  const [loading, setLoading] = useState(null);

  async function handleSelect(plan) {
    setLoading(plan.id);
    try {
      const priceId = billing === 'monthly' ? plan.monthlyPriceId : plan.annualPriceId;
      const { data } = await api.post('/api/stripe/create-checkout', { price_id: priceId });
      window.location.href = data.url;
    } catch {
      toast.error('Could not start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start py-12 px-4">
      {/* Header */}
      <div className="text-center mb-8 max-w-xl">
        <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-destructive" />
        </div>
        <h1 className="text-3xl font-bold mb-2">
          {lockReason === 'payment_failed' ? 'Payment Required' : 'Your Trial Has Ended'}
        </h1>
        <p className="text-muted-foreground">
          {lockReason === 'payment_failed'
            ? 'Your last payment failed. Select a plan below to restore access.'
            : 'Your 30-day free trial has expired. Choose a plan to continue using Cadence.'}
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center gap-3 mb-8 bg-card border rounded-xl p-1">
        <button
          onClick={() => setBilling('monthly')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${billing === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBilling('annual')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${billing === 'annual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Annual
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Save 17%</Badge>
        </button>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full max-w-6xl">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-card border rounded-xl p-5 flex flex-col gap-4 ${plan.popular ? 'border-primary shadow-lg' : 'border-border'}`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground text-xs px-3">Most Popular</Badge>
              </div>
            )}
            <div>
              <h3 className="font-bold text-base">{plan.name}</h3>
              <p className="text-xs text-muted-foreground">{plan.description}</p>
            </div>
            <div>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-bold">
                  ${billing === 'monthly' ? plan.monthlyPrice : plan.annualPrice}
                </span>
                <span className="text-sm text-muted-foreground mb-1">
                  {billing === 'monthly' ? '/mo' : '/yr'}
                </span>
              </div>
              {billing === 'annual' && (
                <p className="text-xs text-green-600">
                  ${(plan.annualPrice / 12).toFixed(0)}/mo billed annually
                </p>
              )}
            </div>
            <ul className="space-y-1.5 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="w-full"
              variant={plan.popular ? 'default' : 'outline'}
              disabled={loading === plan.id}
              onClick={() => handleSelect(plan)}
            >
              {loading === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Select Plan'}
            </Button>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-8">
        Payments secured by Stripe. Cancel anytime.
      </p>
    </div>
  );
}
