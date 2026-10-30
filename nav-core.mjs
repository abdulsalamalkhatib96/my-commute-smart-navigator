/** Pure geographic helpers; coordinates are always [longitude, latitude]. */
export const EARTH_RADIUS_M = 6371008.8;
export const toRad = degree => degree * Math.PI / 180;

export function haversine(a, b) {
  const [lng1, lat1] = a.map(toRad);
  const [lng2, lat2] = b.map(toRad);
  const dLat = lat2 - lat1, dLon = lng2 - lng1;
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidCoordinate(coord) {
  return Array.isArray(coord) && coord.length === 2 && coord.every(Number.isFinite)
    && Math.abs(coord[0]) <= 180 && Math.abs(coord[1]) <= 90;
}

function projected(point, origin) {
  const lat = toRad(origin[1]);
  return {x: toRad(point[0] - origin[0]) * EARTH_RADIUS_M * Math.cos(lat),
    y: toRad(point[1] - origin[1]) * EARTH_RADIUS_M};
}

/** Nearest segment within a polyline, using a local plane for interpolation. */
export function nearestOnLine(point, coordinates) {
  if (!Array.isArray(coordinates) || !coordinates.length || !isValidCoordinate(point)) return null;
  if (coordinates.length === 1) return {lateralMeters: haversine(point, coordinates[0]), remainingMeters: 0};
  let cumulative = 0, total = 0, best = null;
  const lengths = [];
  for (let i = 1; i < coordinates.length; i++) {
    const d = haversine(coordinates[i-1], coordinates[i]);
    lengths.push(d); total += d;
  }
  for (let i = 1; i < coordinates.length; i++) {
    const a = projected(coordinates[i-1], point), b = projected(coordinates[i], point);
    const vx = b.x-a.x, vy = b.y-a.y, length2 = vx*vx+vy*vy;
    const t = length2 ? Math.max(0, Math.min(1, -(a.x*vx + a.y*vy) / length2)) : 0;
    const dx = a.x + t*vx, dy = a.y + t*vy;
    const lateralMeters = Math.hypot(dx, dy);
    if (!best || lateralMeters < best.lateralMeters) {
      best = {lateralMeters, remainingMeters: Math.max(0, total - cumulative - t*lengths[i-1]),
        alongMeters: cumulative + t*lengths[i-1], segmentIndex:i-1};
    }
    cumulative += lengths[i-1];
  }
  return best;
}

/** Approximate position on the current step. No lane-level GPS detection. */
export function progressOnSteps(point, steps) {
  let closest = null;
  for (let i = 0; i < steps.length; i++) {
    const match = nearestOnLine(point, steps[i]?.geometry?.coordinates);
    if (!match) continue;
    if (!closest || match.lateralMeters < closest.lateralMeters) closest = {...match, stepIndex:i};
  }
  return closest;
}

export function laneSummary(step) {
  // Only the intersection at the start of the upcoming step is relevant to its maneuver.
  // Never pick lanes from a later intersection: that would mislead at the next junction.
  const withLanes = step?.intersections?.[0];
  if (!Array.isArray(withLanes?.lanes) || !withLanes.lanes.length) return null;
  if (!withLanes) return null;
  return withLanes.lanes.map((lane, i) => ({
    index: i+1, valid: lane.valid === true,
    indications: Array.isArray(lane.indications) ? lane.indications : []
  }));
}

export function formatMinutes(seconds) {
  return `${Math.max(1, Math.ceil(seconds / 60))} دقيقة`;
}

export function routeIsPlausible(route) {
  return Number.isFinite(route?.duration) && route.duration > 0 && Number.isFinite(route?.distance)
    && Array.isArray(route?.geometry?.coordinates) && route.geometry.coordinates.length >= 2;
}
