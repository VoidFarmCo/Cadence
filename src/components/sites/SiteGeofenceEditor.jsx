import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export default function SiteGeofenceEditor({ site, open, onClose, onSave }) {
  const [radius, setRadius] = useState(site?.radius_meters ?? 200);
  const [saving, setSaving] = useState(false);

  // Sync when site changes
  useEffect(() => {
    if (site) setRadius(site.radius_meters ?? 200);
  }, [site]);

  if (!site) return null;

  async function handleSave() {
    setSaving(true);
    await onSave(site.id, radius);
    setSaving(false);
    onClose();
  }

  const lat = site.latitude;
  const lng = site.longitude;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adjust Geofence — {site.name}</DialogTitle>
          <DialogDescription className="sr-only">Adjust the geofence radius for this site</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Map */}
          <div className="rounded-xl overflow-hidden border border-border h-72 w-full">
            <MapContainer
              center={[lat, lng]}
              zoom={17}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapRecenter lat={lat} lng={lng} />
              <Marker position={[lat, lng]} />
              <Circle
                center={[lat, lng]}
                radius={radius}
                pathOptions={{ color: 'hsl(152 45% 28%)', fillColor: 'hsl(152 45% 28%)', fillOpacity: 0.15, weight: 2 }}
              />
            </MapContainer>
          </div>

          {/* Radius slider + input */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Geofence Radius</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={25}
                  max={5000}
                  value={radius}
                  onChange={e => setRadius(Math.max(25, Math.min(5000, parseInt(e.target.value) || 25)))}
                  className="w-24 text-right h-8 text-sm"
                />
                <span className="text-sm text-muted-foreground">meters</span>
              </div>
            </div>
            <Slider
              min={25}
              max={5000}
              step={25}
              value={[radius]}
              onValueChange={([v]) => setRadius(v)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>25 m</span>
              <span>~{(radius / 1000).toFixed(2)} km</span>
              <span>5000 m</span>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Radius'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}