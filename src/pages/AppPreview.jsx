import { ArrowLeft, Clock, FileText, DollarSign, Users, CheckCircle2, Menu, LogOut, Settings, BarChart3, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

export default function AppPreview() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <h1 className="text-xl font-bold">WorkForce Platform</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* Manager Dashboard */}
        <section>
          <h2 className="text-3xl font-bold text-foreground mb-2">Manager Dashboard</h2>
          <p className="text-muted-foreground mb-6">Control everything from one centralized dashboard</p>
          
          <div className="bg-card border rounded-lg overflow-hidden shadow-lg">
            {/* Mockup Header */}
            <div className="bg-sidebar border-b p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Menu className="w-5 h-5 text-sidebar-foreground" />
                <span className="font-semibold text-sidebar-foreground">WorkForce Manager</span>
              </div>
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-sidebar-foreground" />
                <LogOut className="w-4 h-4 text-sidebar-foreground" />
              </div>
            </div>

            {/* Mockup Content */}
            <div className="p-6 space-y-6">
              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-secondary p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Total Workers</p>
                  <p className="text-2xl font-bold text-foreground">24</p>
                </div>
                <div className="bg-secondary p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Clocked In</p>
                  <p className="text-2xl font-bold text-success">18</p>
                </div>
                <div className="bg-secondary p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Pending Approvals</p>
                  <p className="text-2xl font-bold text-accent">5</p>
                </div>
                <div className="bg-secondary p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Active Pay Period</p>
                  <p className="text-lg font-bold text-foreground">Open</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <p className="font-semibold text-foreground mb-3">Quick Actions</p>
                <div className="grid grid-cols-3 gap-3">
                  <Button className="w-full" variant="outline">Approve Time</Button>
                  <Button className="w-full" variant="outline">Process Payroll</Button>
                  <Button className="w-full" variant="outline">View Reports</Button>
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <p className="font-semibold text-foreground mb-3">Recent Activity</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-2 bg-secondary rounded">
                    <span>Sarah clocked in at Site 1</span>
                    <span className="text-muted-foreground">2 min ago</span>
                  </div>
                  <div className="flex justify-between p-2 bg-secondary rounded">
                    <span>Time entries submitted for approval</span>
                    <span className="text-muted-foreground">15 min ago</span>
                  </div>
                  <div className="flex justify-between p-2 bg-secondary rounded">
                    <span>Payroll locked for review</span>
                    <span className="text-muted-foreground">1 hour ago</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Worker Dashboard */}
        <section className="border-t pt-16">
          <h2 className="text-3xl font-bold text-foreground mb-2">Worker Dashboard</h2>
          <p className="text-muted-foreground mb-6">Simple, intuitive interface for clocking in and managing work</p>
          
          <div className="bg-card border rounded-lg overflow-hidden shadow-lg">
            {/* Mockup Header */}
            <div className="bg-sidebar border-b p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Menu className="w-5 h-5 text-sidebar-foreground" />
                <span className="font-semibold text-sidebar-foreground">My WorkForce</span>
              </div>
              <LogOut className="w-4 h-4 text-sidebar-foreground" />
            </div>

            {/* Mockup Content */}
            <div className="p-6 space-y-6">
              {/* Clock Status */}
              <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-8 rounded-lg text-center">
                <p className="text-sm mb-2">Current Status</p>
                <p className="text-4xl font-bold mb-4">09:42:18</p>
                <Button className="w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold" size="lg">
                  Clock Out
                </Button>
              </div>

              {/* Weekly Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-secondary p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">This Week</p>
                  <p className="text-2xl font-bold text-foreground">38.5 hrs</p>
                </div>
                <div className="bg-secondary p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Overtime</p>
                  <p className="text-2xl font-bold text-foreground">0 hrs</p>
                </div>
                <div className="bg-secondary p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">PTO Balance</p>
                  <p className="text-2xl font-bold text-foreground">12 hrs</p>
                </div>
              </div>

              {/* Quick Links */}
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Clock className="w-4 h-4" />
                  My Timesheet
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <FileText className="w-4 h-4" />
                  Time Off
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <DollarSign className="w-4 h-4" />
                  Pay & Tax Forms
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <BarChart3 className="w-4 h-4" />
                  My Profile
                </Button>
              </div>

              {/* Today's Entry */}
              <div>
                <p className="font-semibold text-foreground mb-3">Today (Apr 14)</p>
                <div className="space-y-2 bg-secondary p-4 rounded-lg text-sm">
                  <div className="flex justify-between">
                    <span>Clock In</span>
                    <span className="font-semibold">09:00 AM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current</span>
                    <span className="text-primary font-semibold">09:42 AM (clocked in)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Overview */}
        <section className="border-t pt-16">
          <h2 className="text-2xl font-bold text-foreground mb-6">Key Features</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                GPS Time Tracking
              </h3>
              <p className="text-sm text-muted-foreground">Employees clock in with GPS verification for accurate location tracking</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                Automated Payroll
              </h3>
              <p className="text-sm text-muted-foreground">Calculate overtime, taxes, and generate payroll reports automatically</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                Time Approval Workflow
              </h3>
              <p className="text-sm text-muted-foreground">Managers review and approve time entries before payroll processing</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                Tax Compliance
              </h3>
              <p className="text-sm text-muted-foreground">Digital tax forms (W-4, I-9) and integrated compliance management</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                QuickBooks Integration
              </h3>
              <p className="text-sm text-muted-foreground">Sync payroll data directly to QuickBooks for seamless accounting</p>
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
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to streamline your payroll?</h2>
          <p className="text-muted-foreground mb-8">Start your free trial today—no credit card required</p>
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