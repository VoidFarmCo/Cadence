import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MapPin, Plus, Navigation, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import SiteGeofenceEditor from '@/components/sites/SiteGeofenceEditor';

export default function Sites() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radius_meters: '200', address: '' });
  const [editingSite, setEditingSite] = useState(null);

  useEffect(() => { loadSites(); }, []);

  async function loadSites() {
    const s = await base44.entities.Site.list('-created_date');
    setSites(s);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.name || !form.latitude || !form.longitude) {
      toast.error('Name and coordinates are required');
      return;
    }
    try {
      await base44.entities.Site.create({
        name: form.name,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        radius_meters: parseInt(form.radius_meters) || 200,
        address: form.address,
        status: 'active'
      });
      toast.success(`Site "${form.name}" created`);
      setDialogOpen(false);
      setForm({ name: '', latitude: '', longitude: '', radius_meters: '200', address: '' });
      loadSites();
    } catch (err) {
      toast.error('Failed to create site');
    }
  }

  async function handleSaveRadius(siteId, radius) {
    await base44.entities.Site.update(siteId, { radius_meters: radius });
    toast.success('Geofence radius updated');
    loadSites();
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) })),
      () => toast.error('Could not get location')
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Sites & Fields</h1>
          <p className="text-sm text-muted-foreground mt-1">{sites.length} location{sites.length !== 1 ? 's' : ''} configured</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />Add Site</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Site</DialogTitle><DialogDescription className="sr-only">Add a new work site with GPS coordinates</DialogDescription></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Site Name</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="North Field" />
              </div>
              <div className="space-y-2">
                <Label>Address (optional)</Label>
                <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="123 Farm Rd, Las Cruces, NM" />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-2">
                  <Label>Latitude</Label>
                  <Input type="number" step="any" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} placeholder="32.3199" />
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Longitude</Label>
                  <Input type="number" step="any" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} placeholder="-106.7637" />
                </div>
                <Button type="button" variant="outline" size="icon" onClick={useCurrentLocation} title="Use current location">
                  <Navigation className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Geofence Radius (meters)</Label>
                <Input type="number" value={form.radius_meters} onChange={e => setForm({ ...form, radius_meters: e.target.value })} />
              </div>
              <Button onClick={handleCreate} className="w-full">Create Site</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sites.map(site => (
          <div key={site.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <Badge variant="secondary" className={site.status === 'active' ? 'bg-success/10 text-success' : ''}>
                {site.status}
              </Badge>
            </div>
            <h3 className="text-sm font-semibold">{site.name}</h3>
            {site.address && <p className="text-xs text-muted-foreground mt-1">{site.address}</p>}
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span>{site.latitude?.toFixed(4)}, {site.longitude?.toFixed(4)}</span>
              <span>{site.radius_meters}m radius</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full gap-2 text-xs h-8"
              onClick={() => setEditingSite(site)}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Adjust Geofence
            </Button>
          </div>
        ))}
      </div>

      {sites.length === 0 && (
        <div className="bg-card rounded-xl border border-border py-16 text-center">
          <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">No sites configured yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add your first field or work site to enable GPS tracking</p>
        </div>
      )}

      <SiteGeofenceEditor
        site={editingSite}
        open={!!editingSite}
        onClose={() => setEditingSite(null)}
        onSave={handleSaveRadius}
      />
    </div>
  );
}