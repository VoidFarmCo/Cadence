import { ArrowLeft, Clock, FileText, DollarSign, Users, CheckCircle2, Menu, LogOut, Settings, BarChart3, ArrowRight, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

export default function AppPreview() {
  const navigate = useNavigate();

  // Apple-style mobile phone mockup component
  const PhoneMockup = ({ title, children }) => (
    <div className="flex justify-center">
      <div className="w-80 bg-black rounded-3xl shadow-2xl p-3 border-8 border-black">
        {/* Phone notch */}
        <div className="bg-black rounded-2xl px-6 py-2 flex justify-between items-center mb-2">
          <span className="text-xs text-white font-semibold">{title}</span>
          <div className="flex gap-1">
            <div className="w-1 h-1 bg-white rounded-full"></div>
            <div className="w-1 h-1 bg-white rounded-full"></div>
          </div>
        </div>
        {/* Screen content */}
        <div className="bg-background rounded-2xl overflow-hidden h-96">
          {children}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <h1 className="text-xl font-bold">Cadence App Preview</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-20">
        {/* Admin Dashboard */}
        <section>
          <h2 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h2>
          <p className="text-muted-foreground mb-8">Full control over workforce operations</p>
          
          <PhoneMockup title="Admin">
            <div className="h-full flex flex-col bg-gradient-to-b from-primary/20 to-background p-4 space-y-4 overflow-y-auto">
              <div className="flex justify-between items-center pt-2">
                <h3 className="font-bold text-lg">Dashboard</h3>
                <Settings className="w-5 h-5 text-primary" />
              </div>
              
              <div className="bg-primary text-primary-foreground p-4 rounded-lg text-center">
                <p className="text-xs opacity-90">Team Status</p>
                <p className="text-3xl font-bold">18/24</p>
                <p className="text-xs opacity-90">Workers Clocked In</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-secondary p-3 rounded-lg">
                  <p className="opacity-70 mb-1">Pending</p>
                  <p className="text-xl font-bold text-accent">7</p>
                </div>
                <div className="bg-secondary p-3 rounded-lg">
                  <p className="opacity-70 mb-1">Approved</p>
                  <p className="text-xl font-bold text-success">42</p>
                </div>
              </div>

              <Button className="w-full" size="sm">Process Payroll</Button>
              <Button variant="outline" className="w-full" size="sm">Manage Team</Button>
              <Button variant="outline" className="w-full" size="sm">View Reports</Button>
            </div>
          </PhoneMockup>
        </section>

        {/* Manager Dashboard */}
        <section className="border-t pt-16">
          <h2 className="text-3xl font-bold text-foreground mb-2">Manager Dashboard</h2>
          <p className="text-muted-foreground mb-8">Oversee your team and approve timesheets</p>
          
          <PhoneMockup title="Manager">
            <div className="h-full flex flex-col bg-background p-4 space-y-3 overflow-y-auto">
              <div className="flex justify-between items-center pt-2">
                <h3 className="font-bold">My Team</h3>
                <Menu className="w-5 h-5" />
              </div>

              <div className="bg-secondary rounded-lg p-3 text-sm">
                <p className="font-semibold mb-2">Approvals Waiting</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Sarah - 40 hrs</span>
                    <span className="text-accent font-bold">Pending</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mike - 36 hrs</span>
                    <span className="text-accent font-bold">Pending</span>
                  </div>
                </div>
              </div>

              <Button className="w-full" size="sm">Review Timesheets</Button>
              
              <div className="bg-secondary rounded-lg p-3 text-xs mt-2">
                <p className="font-semibold mb-1">Team Hours This Week</p>
                <p className="text-lg font-bold">156 hrs</p>
              </div>

              <Button variant="outline" className="w-full" size="sm">Team Schedule</Button>
              <Button variant="outline" className="w-full" size="sm">Time Off Requests</Button>
            </div>
          </PhoneMockup>
        </section>

        {/* Employee Dashboard */}
        <section className="border-t pt-16">
          <h2 className="text-3xl font-bold text-foreground mb-2">Employee Dashboard</h2>
          <p className="text-muted-foreground mb-8">Clock in, track hours, and manage work</p>
          
          <PhoneMockup title="Cadence">
            <div className="h-full flex flex-col bg-background p-4 space-y-4 overflow-y-auto">
              <div className="flex justify-between items-center pt-2">
                <h3 className="font-bold">Today</h3>
                <Menu className="w-5 h-5" />
              </div>

              <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 rounded-2xl text-center">
                <p className="text-xs opacity-90 mb-1">Current Time</p>
                <p className="text-4xl font-bold mb-3">09:42</p>
                <Button className="w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold" size="sm">
                  Clock Out
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs text-center">
                <div className="bg-secondary p-2 rounded-lg">
                  <p className="opacity-70">This Week</p>
                  <p className="font-bold">38.5 hrs</p>
                </div>
                <div className="bg-secondary p-2 rounded-lg">
                  <p className="opacity-70">Overtime</p>
                  <p className="font-bold">0 hrs</p>
                </div>
                <div className="bg-secondary p-2 rounded-lg">
                  <p className="opacity-70">PTO Balance</p>
                  <p className="font-bold">12 hrs</p>
                </div>
              </div>

              <Button variant="outline" className="w-full" size="sm">View Timesheet</Button>
              <Button variant="outline" className="w-full" size="sm">Request Time Off</Button>
              <Button variant="outline" className="w-full" size="sm">Tax Forms</Button>
            </div>
          </PhoneMockup>
        </section>

        {/* Key Features */}
        <section className="border-t pt-16">
          <h2 className="text-2xl font-bold text-foreground mb-6">Why Choose Cadence</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                GPS-Verified Clocking
              </h3>
              <p className="text-sm text-muted-foreground">Employees clock in with GPS verification for accurate location tracking</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                Instant Payroll
              </h3>
              <p className="text-sm text-muted-foreground">Calculate overtime and taxes automatically with one-click processing</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                Approval Workflows
              </h3>
              <p className="text-sm text-muted-foreground">Managers review and approve time entries before payroll processing</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                Full Compliance
              </h3>
              <p className="text-sm text-muted-foreground">Digital tax forms, expense tracking, and compliance management</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                Multi-Site Support
              </h3>
              <p className="text-sm text-muted-foreground">Manage multiple work locations with geofencing and real-time tracking</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                Mobile-First Design
              </h3>
              <p className="text-sm text-muted-foreground">Works seamlessly on phones and tablets for on-the-go access</p>
            </Card>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t pt-16 text-center pb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to transform your payroll?</h2>
          <p className="text-muted-foreground mb-8">Join teams using Cadence to streamline workforce management</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/')}>
              Get Started
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/')}>
              Back to Home
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}