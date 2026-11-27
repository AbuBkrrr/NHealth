// Leaflet + OpenStreetMap (no API key). Loaded lazily so it doesn't slow first paint.
let L = null;
async function lib() {
  if (L) return L;
  const [mod] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
  L = mod.default || mod;
  return L;
}
const pin = (emoji) => ({ html: `<div style="font-size:26px;line-height:26px">${emoji}</div>`, className: '', iconSize: [26, 26], iconAnchor: [13, 24] });

/** Creates a map in `el`. Returns { setMarker(key, lat, lng, emoji, label), moveMarker(...), setLine(key, a, b), fit(), destroy() }. */
export async function createMap(el, center = [6.5244, 3.3792], zoom = 13) {
  const Lf = await lib();
  const m = Lf.map(el, { zoomControl: true, attributionControl: true }).setView(center, zoom);
  Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
  const markers = {};
  let gone = false;
  return {
    map: m,
    setMarker(key, lat, lng, emoji = '📍', label = '') {
      if (gone || lat == null || lng == null) return;
      if (markers[key]) markers[key].setLatLng([lat, lng]);
      else { markers[key] = Lf.marker([lat, lng], { icon: Lf.divIcon(pin(emoji)) }).addTo(m); if (label) markers[key].bindPopup(label); }
    },
    /** Glides a marker to its new position (like a ride app) instead of jumping. */
    moveMarker(key, lat, lng, emoji, label) {
      if (gone || lat == null || lng == null) return;
      const mk = markers[key];
      if (!mk) return this.setMarker(key, lat, lng, emoji, label);
      const from = mk.getLatLng(); const t0 = performance.now(); const dur = 1200;
      cancelAnimationFrame(mk._nhAnim);
      const step = (t) => { if (gone) return; const k = Math.min(1, (t - t0) / dur); mk.setLatLng([from.lat + (lat - from.lat) * k, from.lng + (lng - from.lng) * k]); if (k < 1) mk._nhAnim = requestAnimationFrame(step); };
      mk._nhAnim = requestAnimationFrame(step);
    },
    /** Dashed line between two points (e.g. ambulance -> patient). */
    setLine(key, a, b) {
      if (gone || !a || !b) return;
      if (markers['line:' + key]) markers['line:' + key].setLatLngs([a, b]);
      else markers['line:' + key] = Lf.polyline([a, b], { color: '#D32F2F', weight: 3, dashArray: '6 8', opacity: 0.8 }).addTo(m);
    },
    /** True when the point is inside the visible map. */
    inView(lat, lng) { if (gone) return true; m.invalidateSize(); return m.getBounds().pad(-0.1).contains([lat, lng]); },
    fit(animate = false) { if (gone) return; m.invalidateSize(); const pts = Object.entries(markers).filter(([k]) => !k.startsWith('line:')).map(([, x]) => x.getLatLng()); if (pts.length > 1) m.fitBounds(Lf.latLngBounds(pts), { padding: [30, 30], animate }); else if (pts[0]) m.setView(pts[0], 15, { animate }); },
    destroy() {
      gone = true;
      Object.values(markers).forEach((x) => cancelAnimationFrame(x._nhAnim));
      // A zoom animation still running when the map is removed would throw (Leaflet issue): stop it first.
      m.stop(); m._onZoomTransitionEnd = () => {}; m._move = () => m;
      m.remove();
    },
  };
}
