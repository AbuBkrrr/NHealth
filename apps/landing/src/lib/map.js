// Leaflet + OpenStreetMap (no API key). Loaded lazily so it doesn't slow first paint.
let L = null;
async function lib() {
  if (L) return L;
  const [mod] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
  L = mod.default || mod;
  return L;
}
const pin = (emoji) => ({ html: `<div style="font-size:26px;line-height:26px">${emoji}</div>`, className: '', iconSize: [26, 26], iconAnchor: [13, 24] });

/** Creates a map in `el`. Returns { setMarker(key, lat, lng, emoji, label), fit(), destroy() }. */
export async function createMap(el, center = [6.5244, 3.3792], zoom = 13) {
  const Lf = await lib();
  const m = Lf.map(el, { zoomControl: true, attributionControl: true }).setView(center, zoom);
  Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
  const markers = {};
  return {
    map: m,
    setMarker(key, lat, lng, emoji = '📍', label = '') {
      if (lat == null || lng == null) return;
      if (markers[key]) markers[key].setLatLng([lat, lng]);
      else { markers[key] = Lf.marker([lat, lng], { icon: Lf.divIcon(pin(emoji)) }).addTo(m); if (label) markers[key].bindPopup(label); }
    },
    fit() { const pts = Object.values(markers).map((x) => x.getLatLng()); if (pts.length > 1) m.fitBounds(Lf.latLngBounds(pts), { padding: [30, 30] }); else if (pts[0]) m.setView(pts[0], 15); },
    destroy() { m.remove(); },
  };
}
