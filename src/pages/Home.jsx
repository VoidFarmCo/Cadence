import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Clock, FileText, DollarSign, Users, MapPin, ArrowRight, Star } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const handleSignIn = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/30">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="https://media.base44.com/images/public/69db595f420acc2fe622536d/9b4a5552a_cadence_logo_v3b.png" alt="Cadence" className="w-8 h-8 object-contain" />
            <span className="font-display font-bold text-xl text-primary">Cadence</span>
          </div>
          <Button onClick={handleSignIn} variant="default">
            Sign In
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl lg:text-6xl font-display font-bold text-foreground mb-6 leading-tight">
              Workforce Management Made Simple
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Track time, manage payroll, handle tax forms, and keep your team organized—all in one platform. Built for modern workforce management.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={handleSignIn} size="lg" className="gap-2">
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button onClick={() => navigate('/app-preview')} size="lg" variant="outline">
                See How It Works
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-6 bg-card/50 backdrop-blur">
              <Clock className="w-8 h-8 text-primary mb-3" />
              <p className="font-semibold text-sm">Time Tracking</p>
            </Card>
            <Card className="p-6 bg-card/50 backdrop-blur">
              <DollarSign className="w-8 h-8 text-accent mb-3" />
              <p className="font-semibold text-sm">Payroll</p>
            </Card>
            <Card className="p-6 bg-card/50 backdrop-blur">
              <FileText className="w-8 h-8 text-primary mb-3" />
              <p className="font-semibold text-sm">Tax Forms</p>
            </Card>
            <Card className="p-6 bg-card/50 backdrop-blur">
              <Users className="w-8 h-8 text-accent mb-3" />
              <p className="font-semibold text-sm">Team Management</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-secondary/50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl lg:text-4xl font-display font-bold text-center mb-12">
            Everything You Need
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Clock,
                title: 'GPS-Enabled Time Tracking',
                desc: 'Workers clock in with GPS verification, ensuring accurate location-based time entries'
              },
              {
                icon: MapPin,
                title: 'Multi-Site Management',
                desc: 'Manage multiple work sites with geofencing, track worker locations in real-time'
              },
              {
                icon: FileText,
                title: 'Tax & Compliance Forms',
                desc: 'Automated tax form management, document storage, and compliance tracking'
              },
              {
                icon: DollarSign,
                title: 'Payroll Processing',
                desc: 'Calculate regular and overtime hours, prepare payroll with complete audit trails'
              },
              {
                icon: Users,
                title: 'Team Scheduling',
                desc: 'Create and manage shifts, track availability, and coordinate team schedules'
              },
              {
                icon: CheckCircle2,
                title: 'Approval Workflows',
                desc: 'Multi-level approval system for time entries, expenses, and leave requests'
              }
            ].map((feature, i) => (
              <Card key={i} className="p-6 bg-background/50 backdrop-blur">
                <feature.icon className="w-10 h-10 text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl lg:text-4xl font-display font-bold text-center mb-12">
          Simple Pricing
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { name: 'Solo', price: '$10', users: '1 User', features: ['Time Tracking', 'Basic Reports'] },
            { name: 'Pro', price: '$50', users: '10 Users', features: ['Everything in Solo', 'Team Management', 'Payroll Processing'] },
            { name: 'Business', price: '$150', users: '50 Users', features: ['Everything in Pro', 'Tax Forms', 'Advanced Analytics'] }
          ].map((plan, i) => (
            <Card key={i} className={`p-8 ${i === 1 ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="text-3xl font-bold text-primary mb-1">{plan.price}<span className="text-lg text-muted-foreground">/mo</span></div>
              <p className="text-sm text-muted-foreground mb-6">{plan.users}</p>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex gap-2 items-start">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{f}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" variant={i === 1 ? 'default' : 'outline'}>
                Choose Plan
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-primary/10 to-accent/10 py-16">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-3xl font-display font-bold mb-4">Ready to streamline your workforce?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join companies managing thousands of workers with Cadence. Start your 30-day free trial today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={handleSignIn} size="lg" className="gap-2">
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button onClick={() => navigate('/app-preview')} size="lg" variant="outline">
              Explore Features
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2026 Cadence. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
