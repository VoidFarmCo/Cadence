import { useState, useEffect } from 'react';
import { Sites, Punches, WorkerProfiles } from '@/api/entities';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const workerIcon = new L.DivIcon({
  html: `<div style="width:28px;height:28px;background:#2d6a4f;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.3)">W</div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export default function MapView() {
  const [sites, setSites] = useState([]);
  const [activePunches, setActivePunches] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    const today = new Date().toISOString().split('T')[0];
    const [s, punches, profs] = await Promise.all([
      Sites.list({ status: 'active' }),
      Punches.list({ sort: '-created_date', limit: 200 }),
      WorkerProfiles.list({ status: 'active' }),
    ]);
    setSites(s);
    setProfiles(profs);

    // Determine who is currently clocked in
    const byWorker = {};
    punches.forEach(p => {
      if (!byWorker[p.worker_email] || new Date(p.timestamp) > new Date(byWorker[p.worker_email].timestamp)) {
        byWorker[p.worker_email] = p;
      }
    });
    const clocked = Object.values(byWorker).filter(p =>
      p.punch_type === 'clock_in' || p.punch_type === 'break_end'
    );
    setActivePunches(clocked);
    setLoading(false);
  }

  const center = sites.length > 0
    ? [sites[0].latitude, sites[0].longitude]
    : [32.3199, -106.7637]; // Las Cruces, NM default

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Live Field Map</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activePunches.length} worker{activePunches.length !== 1 ? 's' : ''} currently clocked in · refreshes every 30s
          </p>
        </div>
      </div>

      {/* Worker list */}
      {activePunches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activePunches.map(p => {
            const prof = profiles.find(x => x.user_email === p.worker_email);
            return (
              <div key={p.id} className="flex items-center gap-2 bg-card border border-success/20 rounded-lg px-3 py-1.5">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-xs font-medium">{prof?.full_name || p.worker_name}</span>
                <span className="text-xs text-muted-foreground">{p.site_name || 'No site'}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-border h-[500px]">
        <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* Site geofences */}
          {sites.map(site => (
            <Circle
              key={site.id}
              center={[site.latitude, site.longitude]}
              radius={site.radius_meters || 200}
              pathOptions={{ color: '#2d6a4f', fillColor: '#2d6a4f', fillOpacity: 0.1, weight: 2 }}
            >
              <Popup>
                <strong>{site.name}</strong><br />
                Radius: {site.radius_meters || 200}m
              </Popup>
            </Circle>
          ))}
          {/* Active worker pins */}
          {activePunches.filter(p => p.latitude && p.longitude).map(p => {
            const prof = profiles.find(x => x.user_email === p.worker_email);
            const initial = (prof?.full_name || p.worker_name || '?').charAt(0).toUpperCase();
            const icon = new L.DivIcon({
              html: `<div style="width:28px;height:28px;background:#2d6a4f;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${initial}</div>`,
              className: '', iconSize: [28, 28], iconAnchor: [14, 14],
            });
            return (
              <Marker key={p.id} position={[p.latitude, p.longitude]} icon={icon}>
                <Popup>
                  <strong>{prof?.full_name || p.worker_name}</strong><br />
                  Site: {p.site_name || 'Unknown'}<br />
                  Punched in: {p.timestamp ? format(new Date(p.timestamp), 'h:mm a') : ''}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        Workers only appear on map if GPS coordinates were captured at punch-in. Green circles = site geofences.
      </p>
    </div>
  );
}
