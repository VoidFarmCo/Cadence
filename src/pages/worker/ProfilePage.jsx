import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DollarSign, MapPin, LogOut, Shield, Smartphone, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect } from 'react';

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me();
      setUser(me);
      const profiles = await base44.entities.WorkerProfile.filter({ user_email: me.email });
      setProfile(profiles[0]);
      setLoading(false);
    }
    load();
  }, []);

  async function updatePayPreference(value) {
    if (profile) {
      await base44.entities.WorkerProfile.update(profile.id, { pay_preference: value });
      setProfile(prev => ({ ...prev, pay_preference: value }));
      toast.success('Pay preference updated');
    }
  }

  async function handleDeleteAccount() {
    if (deleteInput.trim().toLowerCase() !== 'delete') return;
    toast.loading('Deleting account...');
    if (profile) await base44.entities.WorkerProfile.delete(profile.id);
    await base44.auth.logout();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-slide-up">
      <h1 className="text-xl font-bold font-display">Profile</h1>

      {/* User Info */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div>
            <p className="text-lg font-semibold">{user?.full_name || 'User'}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs capitalize">{user?.role || 'worker'}</Badge>
              {profile && <Badge variant="outline" className="text-xs capitalize">{profile.worker_type}</Badge>}
            </div>
          </div>
        </div>
      </div>

      {/* Work Details */}
      {profile && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />Work Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Pay Rate</p>
              <p className="text-sm font-medium">{profile.pay_rate ? `$${profile.pay_rate}/hr` : 'Not set'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-sm font-medium capitalize">{profile.status}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">PTO Balance</p>
              <p className="text-sm font-medium">{profile.pto_balance || 0} hours</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sick Balance</p>
              <p className="text-sm font-medium">{profile.sick_balance || 0} hours</p>
            </div>
          </div>
        </div>
      )}

      {/* Getting Paid */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />Getting Paid
        </h2>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Payment Preference</Label>
            <Select value={profile?.pay_preference || ''} onValueChange={updatePayPreference}>
              <SelectTrigger><SelectValue placeholder="Select preference" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="direct_deposit">Direct Deposit</SelectItem>
                <SelectItem value="paper_check">Paper Check</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {profile?.pay_preference === 'direct_deposit' && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Direct Deposit Setup</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {profile?.dd_status === 'setup_in_qb' ? 'Set up in QuickBooks' : 'Not set up yet'}
                  </p>
                </div>
                <Badge variant="secondary" className={profile?.dd_status === 'setup_in_qb' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                  {profile?.dd_status === 'setup_in_qb' ? 'Active' : 'Pending'}
                </Badge>
              </div>
              {profile?.dd_status !== 'setup_in_qb' && (
                <p className="text-xs text-muted-foreground mt-3">
                  Contact your employer to set up direct deposit through QuickBooks.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* GPS Permissions */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" />Permissions
        </h2>
        <p className="text-xs text-muted-foreground">
          Location access is needed for GPS time tracking. Make sure location is enabled in your device settings.
        </p>
        <Button variant="outline" size="sm" onClick={() => {
          navigator.geolocation.getCurrentPosition(
            () => toast.success('GPS is working!'),
            () => toast.error('GPS access denied. Enable in device settings.')
          );
        }}>
          <MapPin className="w-4 h-4 mr-2" />Test GPS
        </Button>
      </div>

      <Button variant="outline" className="w-full gap-2 text-destructive select-none" onClick={() => base44.auth.logout()}>
        <LogOut className="w-4 h-4" />Sign Out
      </Button>

      {!showDeleteConfirm ? (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full text-xs text-muted-foreground underline underline-offset-2 pb-2 select-none"
        >
          Delete Account
        </button>
      ) : (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-sm font-semibold text-destructive">Delete Account</p>
          </div>
          <p className="text-xs text-muted-foreground">This is permanent. Type <strong>delete</strong> to confirm.</p>
          <input
            type="text"
            value={deleteInput}
            onChange={e => setDeleteInput(e.target.value)}
            placeholder="Type delete to confirm"
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
          />
          <div className="flex gap-2">
            <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }} className="flex-1 text-sm border border-border rounded-md py-2 select-none">Cancel</button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleteInput.trim().toLowerCase() !== 'delete'}
              className="flex-1 text-sm bg-destructive text-destructive-foreground rounded-md py-2 disabled:opacity-40 select-none"
            >Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}