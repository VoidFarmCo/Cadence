// Calculate distance between two lat/lng points in meters using Haversine formula
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isWithinGeofence(userLat, userLon, siteLat, siteLon, radiusMeters) {
  const distance = getDistanceMeters(userLat, userLon, siteLat, siteLon);
  return distance <= radiusMeters;
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

export const OOG_REASONS = [
  { value: 'offsite_moving_equipment', label: 'Working offsite / moving equipment' },
  { value: 'forgot_to_clock', label: 'Forgot to clock earlier' },
  { value: 'site_not_listed', label: 'Site not listed' },
  { value: 'gps_inaccurate', label: 'GPS inaccurate' },
  { value: 'other', label: 'Other (add note)' },
];