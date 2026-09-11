/** Great-circle distance between two lat/lng points, in kilometers. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Sorts a list of records by distance from (lat, lng), if provided. Records
 * missing coordinates sort to the end rather than being dropped, since a
 * provider without a location on file is still a valid result - just one we
 * can't rank by proximity.
 */
export function withDistanceSorted<T extends { lat?: number | null; lng?: number | null }>(
  items: T[],
  lat?: number,
  lng?: number
): (T & { distanceKm?: number })[] {
  if (lat === undefined || lng === undefined) return items;

  const withDistance = items.map((item) => ({
    ...item,
    distanceKm: item.lat != null && item.lng != null ? distanceKm(lat, lng, item.lat, item.lng) : undefined,
  }));

  return withDistance.sort((a, b) => {
    if (a.distanceKm === undefined && b.distanceKm === undefined) return 0;
    if (a.distanceKm === undefined) return 1;
    if (b.distanceKm === undefined) return -1;
    return a.distanceKm - b.distanceKm;
  });
}
