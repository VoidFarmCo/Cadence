import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Clock, MapPin, DollarSign, FileText, Users, TrendingUp, ArrowRight, Zap } from 'lucide-react';

export default function AppPreview() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="font-display font-bold text-lg text-primary">WorkForce</div>
          <div className="text-sm text-muted-foreground">App Preview</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Overview */}
        <div className="mb-16">
          <h1 className="text-4xl font-display font-bold mb-4">Explore WorkForce</h1>
          <p className="text-xl text-muted-foreground">See how WorkForce streamlines workforce management for employers and workers.</p>
        </div>

        {/* For Employers */}
        <div className="mb-20">
          <h2 className="text-2xl font-display font-bold mb-8">For Employers</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-8 hover:shadow-lg transition-shadow">
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-3">Time Tracking Dashboard</h3>
              <p className="text-muted-foreground mb-4">
                Monitor real-time punch data from all workers with GPS verification and geofence tracking.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Live punch status
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> GPS verification
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Geofence alerts
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-shadow">
              <div className="bg-accent/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-3">Time Approval Workflows</h3>
              <p className="text-muted-foreground mb-4">
                Review and approve time entries with built-in audit trails and rejection workflows.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Bulk approvals
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Rejection reasons
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Audit logs
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-shadow">
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-3">Payroll Processing</h3>
              <p className="text-muted-foreground mb-4">
                Calculate overtime, export payroll files, and integrate with accounting systems.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> OT calculation
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> CSV/IIF export
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Check.hq ready
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-shadow">
              <div className="bg-accent/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-3">Team Management</h3>
              <p className="text-muted-foreground mb-4">
                Manage worker profiles, roles, pay rates, and direct deposit preferences.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Worker profiles
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Role management
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Pay preferences
                </li>
              </ul>
            </Card>
          </div>
        </div>

        {/* For Workers */}
        <div className="mb-20">
          <h2 className="text-2xl font-display font-bold mb-8">For Workers</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-8 hover:shadow-lg transition-shadow">
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-3">Quick Clock In/Out</h3>
              <p className="text-muted-foreground mb-4">
                Fast one-tap time tracking with automatic GPS capture and geofence validation.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> One-tap punch
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Break tracking
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Offline support
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-shadow">
              <div className="bg-accent/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-3">Timesheet View</h3>
              <p className="text-muted-foreground mb-4">
                Track weekly hours, overtime, and submit timesheets for approval.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Weekly summary
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> OT tracking
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Submit workflow
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-shadow">
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-3">Tax & Compliance</h3>
              <p className="text-muted-foreground mb-4">
                Complete tax forms, upload documents, and track compliance requirements.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Form completion
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Document upload
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Expiration alerts
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-shadow">
              <div className="bg-accent/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-3">Expense Management</h3>
              <p className="text-muted-foreground mb-4">
                Track and submit work expenses with photo receipts and approval tracking.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Mileage tracking
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Receipt capture
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Auto-categorization
                </li>
              </ul>
            </Card>
          </div>
        </div>

        {/* Key Features */}
        <div className="bg-secondary/50 rounded-lg p-12 text-center mb-20">
          <h2 className="text-2xl font-display font-bold mb-4">Built for Compliance & Growth</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Every feature designed with compliance, accuracy, and scalability in mind. From solo operators to enterprise teams.
          </p>
          <div className="grid md:grid-cols-4 gap-6">
            <div>
              <div className="text-3xl font-bold text-primary mb-2">24/7</div>
              <p className="text-sm text-muted-foreground">Support Available</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary mb-2">100%</div>
              <p className="text-sm text-muted-foreground">Data Encrypted</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary mb-2">API</div>
              <p className="text-sm text-muted-foreground">Integrations Ready</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary mb-2">SOC 2</div>
              <p className="text-sm text-muted-foreground">Compliant</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-2xl font-display font-bold mb-4">Ready to get started?</h2>
          <p className="text-muted-foreground mb-8">30-day free trial. No credit card required.</p>
          <Button size="lg" className="gap-2">
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}