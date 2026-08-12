// Generates direct Google Maps Navigation / Direction Link (Driving Mode)
export function getGoogleMapsDirUrl(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`;
}

// Generates direct Google Maps Single Pin Location
export function getGoogleMapsPointUrl(lat: number, lng: number, label?: string): string {
  const query = encodeURIComponent(label ? `${label} @${lat},${lng}` : `${lat},${lng}`);
  return `https://maps.google.com/?q=${query}`;
}

// Generates Multi-Waypoint Google Maps Direction Link for All Active Tasks
export function getGoogleMapsMultiWaypointUrl(
  originLat: number,
  originLng: number,
  waypoints: { lat: number; lng: number }[],
  destLat: number,
  destLng: number
): string {
  const waypointsStr = waypoints.map(w => `${w.lat},${w.lng}`).join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&waypoints=${waypointsStr}&travelmode=driving`;
}
