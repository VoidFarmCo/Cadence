import { ArrowLeft, CheckCircle2, Menu, LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function AppPreview() {
  const navigate = useNavigate();
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedManager, setSelectedManager] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState(null);

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
        <div className="bg-background rounded-2xl overflow-y-auto h-96">
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
          <h2 className="text-3xl font-bold text-foreground mb-2">Cadence Admin Dashboard</h2>
          <p className="text-muted-foreground mb-8">Full control over workforce operations</p>
          
          <div className="bg-card border rounded-lg overflow-hidden shadow-lg">
            {/* Desktop Header */}
            <div className="bg-sidebar border-b p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Menu className="w-5 h-5 text-sidebar-foreground" />
                <span className="font-semibold text-sidebar-foreground">Cadence Admin</span>
              </div>
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-sidebar-foreground" />
                <LogOut className="w-4 h-4 text-sidebar-foreground" />
              </div>
            </div>

            {/* Desktop Content */}
            <div className="p-6 space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-secondary p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Total Workers</p>
                  <p className="text-2xl font-bold text-foreground">247</p>
                </div>
                <div className="bg-secondary p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Clocked In</p>
                  <p className="text-2xl font-bold text-success">184</p>
                </div>
                <div className="bg-secondary p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Pending Approvals</p>
                  <p className="text-2xl font-bold text-accent">23</p>
                </div>
                <div className="bg-secondary p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Payroll Status</p>
                  <p className="text-lg font-bold text-foreground">Open</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-5 gap-3">
                <Button className="w-full" onClick={() => setSelectedSection('payroll')}>Process Payroll</Button>
                <Button variant="outline" className="w-full" onClick={() => setSelectedSection('team')}>Manage Team</Button>
                <Button variant="outline" className="w-full" onClick={() => setSelectedSection('tax')}>Tax Compliance</Button>
                <Button variant="outline" className="w-full" onClick={() => setSelectedSection('reports')}>View Reports</Button>
                <Button variant="outline" className="w-full" onClick={() => setSelectedSection('settings')}>Settings</Button>
              </div>
              
              {selectedSection && (
                <div className="mt-4 p-4 bg-secondary rounded-lg border-l-4 border-primary">
                  <p className="font-semibold text-foreground mb-2">
                    {selectedSection === 'payroll' && '💰 Process Payroll'}
                    {selectedSection === 'team' && '👥 Manage Team'}
                    {selectedSection === 'tax' && '📋 Tax Compliance'}
                    {selectedSection === 'reports' && '📊 View Reports'}
                    {selectedSection === 'settings' && '⚙️ Settings'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedSection === 'payroll' && 'Generate payroll for the current period, calculate taxes, and export to QuickBooks.'}
                    {selectedSection === 'team' && 'Invite workers, manage roles, set pay rates, and track worker status.'}
                    {selectedSection === 'tax' && 'Send tax forms to workers, track submissions, and manage compliance documents.'}
                    {selectedSection === 'reports' && 'View analytics on hours worked, overtime, and team productivity metrics.'}
                    {selectedSection === 'settings' && 'Configure company details, pay periods, overtime rules, and integrations.'}
                  </p>
                </div>
              )}

              {/* Two Column Layout */}
              <div className="grid grid-cols-2 gap-6">
                {/* Recent Activity */}
                <div>
                  <p className="font-semibold text-foreground mb-3">Recent Activity</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-3 bg-secondary rounded">
                      <span>Sarah clocked in at Site 1</span>
                      <span className="text-muted-foreground">2 min ago</span>
                    </div>
                    <div className="flex justify-between p-3 bg-secondary rounded">
                      <span>Time entries submitted</span>
                      <span className="text-muted-foreground">15 min ago</span>
                    </div>
                    <div className="flex justify-between p-3 bg-secondary rounded">
                      <span>Payroll locked for review</span>
                      <span className="text-muted-foreground">1 hour ago</span>
                    </div>
                    <div className="flex justify-between p-3 bg-secondary rounded">
                      <span>New worker invited</span>
                      <span className="text-muted-foreground">2 hours ago</span>
                    </div>
                  </div>
                </div>

                {/* Pending Items */}
                <div>
                  <p className="font-semibold text-foreground mb-3">Pending Reviews</p>
                  <div className="space-y-2 text-sm">
                    <div className="p-3 bg-secondary rounded border-l-4 border-accent">
                      <div className="flex justify-between">
                        <span className="font-semibold">Team A Timesheet</span>
                        <span className="text-accent">7 entries</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Waiting for approval</p>
                    </div>
                    <div className="p-3 bg-secondary rounded border-l-4 border-accent">
                      <div className="flex justify-between">
                        <span className="font-semibold">Expense Reports</span>
                        <span className="text-accent">3 entries</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Awaiting admin review</p>
                    </div>
                    <div className="p-3 bg-secondary rounded border-l-4 border-warning">
                      <div className="flex justify-between">
                        <span className="font-semibold">Tax Forms</span>
                        <span className="text-warning">5 incomplete</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Need completion</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Manager & Employee Dashboards */}
        <section className="border-t pt-16">
          <h2 className="text-3xl font-bold text-foreground mb-8">Manager & Employee Dashboards</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
           {/* Manager */}
           <div>
             <h3 className="text-lg font-semibold text-foreground mb-3">Cadence Manager</h3>
             <p className="text-sm text-muted-foreground mb-4">Oversee your team and approve timesheets</p>
             <PhoneMockup title="Cadence">
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
                  <Button className="w-full" size="sm" onClick={() => setSelectedManager('timesheets')}>Review Timesheets</Button>
                  <div className="bg-secondary rounded-lg p-3 text-xs mt-2">
                    <p className="font-semibold mb-1">Team Hours This Week</p>
                    <p className="text-lg font-bold">156 hrs</p>
                  </div>
                  <Button variant="outline" className="w-full" size="sm" onClick={() => setSelectedManager('schedule')}>Team Schedule</Button>
                  <Button variant="outline" className="w-full" size="sm" onClick={() => setSelectedManager('timeoff')}>Time Off Requests</Button>
                </div>
              </PhoneMockup>
              {selectedManager && (
                <div className="mt-3 p-3 bg-secondary rounded-lg text-sm border-l-4 border-primary">
                  <p className="font-semibold">
                    {selectedManager === 'timesheets' && '✅ Review Timesheets — Approve or reject submitted time entries'}
                    {selectedManager === 'schedule' && '📅 Team Schedule — View and manage upcoming shifts'}
                    {selectedManager === 'timeoff' && '🏖️ Time Off Requests — Review pending leave requests'}
                  </p>
                </div>
              )}
            </div>

            {/* Employee */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Cadence Worker</h3>
              <p className="text-sm text-muted-foreground mb-4">Clock in, track hours, and manage work</p>
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
                  <Button variant="outline" className="w-full" size="sm" onClick={() => setSelectedWorker('timesheet')}>View Timesheet</Button>
                  <Button variant="outline" className="w-full" size="sm" onClick={() => setSelectedWorker('timeoff')}>Request Time Off</Button>
                  <Button variant="outline" className="w-full" size="sm" onClick={() => setSelectedWorker('tax')}>Tax Forms</Button>
                </div>
              </PhoneMockup>
              {selectedWorker && (
                <div className="mt-3 p-3 bg-secondary rounded-lg text-sm border-l-4 border-primary">
                  <p className="font-semibold">
                    {selectedWorker === 'timesheet' && '⏱️ View Timesheet — See daily and weekly hour breakdowns'}
                    {selectedWorker === 'timeoff' && '🏖️ Request Time Off — Submit PTO or sick leave requests'}
                    {selectedWorker === 'tax' && '📄 Tax Forms — Complete and submit required tax documents'}
                  </p>
                </div>
              )}
            </div>
          </div>
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