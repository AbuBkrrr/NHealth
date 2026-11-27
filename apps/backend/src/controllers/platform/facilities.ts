// Directory of Nigerian health facilities that exist before they join N-Health (public registries + admin additions).
// Facilities find and claim their listing when they sign up; patients can find and contact facilities not yet on N-Health.
import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { str, num, uid } from './util';

export const CATEGORIES: Record<string, string> = {
  TEACHING_HOSPITAL: 'Teaching hospital', FEDERAL_MEDICAL_CENTRE: 'Federal Medical Centre', GENERAL_HOSPITAL: 'General hospital',
  SPECIALIST_HOSPITAL: 'Specialist hospital', HOSPITAL: 'Hospital', CLINIC: 'Clinic', PRIMARY_HEALTH_CENTRE: 'Primary health centre',
  HEALTH_POST: 'Health post', MATERNITY: 'Maternity', DIAGNOSTIC: 'Diagnostic center', BLOOD_BANK: 'Blood bank', PHARMACY: 'Pharmacy',
  DENTAL: 'Dental', EYE: 'Eye care', NURSING_HOME: 'Nursing home', HMO: 'Health insurance (HMO)', OTHER: 'Other facility',
};
export const HOSPITALS = ['TEACHING_HOSPITAL', 'FEDERAL_MEDICAL_CENTRE', 'GENERAL_HOSPITAL', 'SPECIALIST_HOSPITAL', 'HOSPITAL'];
/** Which listings each kind of N-Health account may claim. */
const CLAIMABLE: Record<string, string[]> = {
  INSTITUTION: [...HOSPITALS, 'CLINIC', 'PRIMARY_HEALTH_CENTRE', 'HEALTH_POST', 'MATERNITY', 'DENTAL', 'EYE', 'NURSING_HOME', 'BLOOD_BANK', 'DIAGNOSTIC', 'OTHER'],
  LAB: ['DIAGNOSTIC', 'BLOOD_BANK'],
  PHARMACY: ['PHARMACY'],
};
const SOURCES: Record<string, string> = { GRID3: 'GRID3 Nigeria health facilities (CC BY 4.0)', OSM: '© OpenStreetMap contributors (ODbL)', NHIA: 'NHIA list of accredited HMOs', NBSA: 'National Blood Service Agency', ADMIN: 'Added by N-Health' };

function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, rad = Math.PI / 180;
  const h = Math.sin(((bLat - aLat) * rad) / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(((bLng - aLng) * rad) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const pub = (f: any, lat?: number, lng?: number) => ({
  id: f.id, name: f.name, category: f.category, categoryLabel: CATEGORIES[f.category] || f.category, level: f.level, ownership: f.ownership, ownershipType: f.ownershipType,
  state: f.state, lga: f.lga, ward: f.ward, address: f.address, phone: f.phone, email: f.email, website: f.website, lat: f.lat, lng: f.lng, functional: f.functional,
  source: SOURCES[f.source] || f.source, onNhealth: !!f.claimedByUserId, userId: f.claimedByUserId || undefined,
  distanceKm: lat !== undefined && lng !== undefined && f.lat != null && f.lng != null ? Math.round(km(lat, lng, f.lat, f.lng) * 10) / 10 : undefined,
});

async function find(req: Request, opts: { onlyUnclaimed?: boolean } = {}) {
  const q = str(req.query.q, 80);
  const cats = String(req.query.category || '').split(',').map((s) => s.trim().toUpperCase()).filter((c) => CATEGORIES[c]);
  const state = str(req.query.state, 40);
  const lat = num(req.query.lat), lng = num(req.query.lng);
  const hmoOnly = cats.length === 1 && cats[0] === 'HMO';
  const limit = Math.min(hmoOnly ? 150 : 50, Math.max(1, Number(req.query.limit) || 20));
  if (!q && (lat === undefined || lng === undefined) && !state && !hmoOnly) throw ApiError.badRequest('Type a name, or share your location');
  const where: any = { hidden: false };
  if (cats.length) where.category = { in: cats };
  if (state) where.state = { equals: state, mode: 'insensitive' };
  if (opts.onlyUnclaimed || req.query.claimable === '1') where.claimedByUserId = null;
  if (q) where.AND = q.split(/\s+/).filter((w) => w.length > 1).slice(0, 5).map((w) => ({ name: { contains: w, mode: 'insensitive' } }));
  let rows;
  if (lat !== undefined && lng !== undefined && !q) {
    // Nearest first: look in a box around the person, widen if it is empty.
    for (const d of [0.15, 0.45, 1.5]) {
      rows = await prisma.facilityListing.findMany({ where: { ...where, lat: { gte: lat - d, lte: lat + d }, lng: { gte: lng - d, lte: lng + d } }, take: 2000 });
      if (rows.length >= limit) break;
    }
    rows = (rows || []).map((f) => pub(f, lat, lng)).sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  } else {
    rows = (await prisma.facilityListing.findMany({ where, take: 300, orderBy: { name: 'asc' } })).map((f) => pub(f, lat, lng));
    // Best name matches first (starts with the search), then nearest when a location is given.
    const ql = (q || '').toLowerCase();
    // Whole words ("LUTH" -> "... Teaching Hospital Luth", not "Lutheran") beat partial matches; then names starting with it.
    const words = ql.split(/\s+/).filter(Boolean).map((w) => new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'));
    const score = (n: string) => words.filter((rx) => rx.test(n)).length * 2 + Number(n.toLowerCase().startsWith(ql));
    rows.sort((a, b) => score(b.name) - score(a.name) || (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) || a.name.length - b.name.length);
  }
  return rows.slice(0, limit);
}

/** GET /api/facilities/search?q=&category=&state=&lat=&lng=&claimable=1 - public (used at sign-up and by visitors). */
export async function search(req: Request, res: Response) {
  res.json(await find(req));
}

/** GET /api/facilities/:id - one listing. */
export async function getListing(req: Request, res: Response) {
  const f = await prisma.facilityListing.findUnique({ where: { id: req.params.id } });
  if (!f || f.hidden) throw ApiError.notFound('Facility not found');
  res.json(pub(f));
}

/** POST /api/facilities/:id/claim - "this is my facility": links the listing to the signed-in provider account. */
export async function claim(req: Request, res: Response) {
  const me = await prisma.user.findUnique({ where: { id: uid(req) }, include: { institutionProfile: true, labProfile: true, pharmacyProfile: true } });
  if (!me) throw ApiError.unauthorized();
  const allowed = CLAIMABLE[me.role];
  if (!allowed) throw ApiError.forbidden('Only hospitals, clinics, diagnostic centers and pharmacies can claim a listing');
  const f = await prisma.facilityListing.findUnique({ where: { id: req.params.id } });
  if (!f || f.hidden) throw ApiError.notFound('Facility not found');
  if (!allowed.includes(f.category)) throw ApiError.badRequest(`A ${CATEGORIES[f.category]?.toLowerCase() || 'facility'} listing cannot be claimed by this type of account`);
  if (f.claimedByUserId && f.claimedByUserId !== me.id) throw ApiError.conflict('This facility has already been claimed. If it is yours, contact support with your documents.');
  const mine = await prisma.facilityListing.findUnique({ where: { claimedByUserId: me.id } });
  if (mine && mine.id !== f.id) await prisma.facilityListing.update({ where: { id: mine.id }, data: { claimedByUserId: null, claimedAt: null } });
  const updated = await prisma.facilityListing.update({ where: { id: f.id }, data: { claimedByUserId: me.id, claimedAt: new Date() } });
  // Fill in what the profile is missing from the listing (address, state, map position).
  const fill = (p: any) => {
    const d: any = {};
    if (p && !p.address && f.address) d.address = f.address;
    if (p && !p.state && f.state) d.state = f.state;
    if (p && p.lat == null && f.lat != null) { d.lat = f.lat; d.lng = f.lng; }
    return d;
  };
  if (me.institutionProfile) { const d = fill(me.institutionProfile); if (!me.institutionProfile.phone && f.phone) d.phone = f.phone; if (Object.keys(d).length) await prisma.institutionProfile.update({ where: { id: me.institutionProfile.id }, data: d }); }
  if (me.labProfile) { const d = fill(me.labProfile); if (Object.keys(d).length) await prisma.labProfile.update({ where: { id: me.labProfile.id }, data: d }); }
  if (me.pharmacyProfile) { const d = fill(me.pharmacyProfile); if (Object.keys(d).length) await prisma.pharmacyProfile.update({ where: { id: me.pharmacyProfile.id }, data: d }); }
  res.json(pub(updated));
}

/** GET /api/facilities/mine - the listing this account claimed (if any). */
export async function myListing(req: Request, res: Response) {
  const f = await prisma.facilityListing.findUnique({ where: { claimedByUserId: uid(req) } });
  res.json(f ? pub(f) : null);
}

/** Nearest hospitals not yet on N-Health (shown to patients in an emergency: "call before you go"). */
export async function nearestUnlistedHospitals(lat: number, lng: number, take = 6) {
  const d = 0.3;
  const rows = await prisma.facilityListing.findMany({
    where: { hidden: false, claimedByUserId: null, category: { in: HOSPITALS }, OR: [{ functional: null }, { functional: { not: 'Not-Functional' } }], lat: { gte: lat - d, lte: lat + d }, lng: { gte: lng - d, lte: lng + d } },
    take: 500,
  });
  return rows.map((f) => pub(f, lat, lng)).filter((f) => (f.distanceKm ?? 99) <= 30).sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9)).slice(0, take);
}

// ------------------------------------------------------------------ admin
/** GET /api/admin-ops/facilities/coverage - what the directory holds, by category, source and state. */
export async function coverage(_req: Request, res: Response) {
  const [byCat, bySource, byState, claimed, noCoords, hidden, setting, total] = await Promise.all([
    prisma.facilityListing.groupBy({ by: ['category'], where: { hidden: false }, _count: true }),
    prisma.facilityListing.groupBy({ by: ['source'], where: { hidden: false }, _count: true }),
    prisma.facilityListing.groupBy({ by: ['state', 'category'], where: { hidden: false }, _count: true }),
    prisma.facilityListing.count({ where: { claimedByUserId: { not: null } } }),
    prisma.facilityListing.count({ where: { hidden: false, lat: null } }),
    prisma.facilityListing.count({ where: { hidden: true } }),
    prisma.platformSetting.findUnique({ where: { key: 'facilityDirectory' } }),
    prisma.facilityListing.count({ where: { hidden: false } }),
  ]);
  const states: Record<string, Record<string, number>> = {};
  for (const r of byState) { const s = r.state || 'Unknown'; (states[s] ||= {})[r.category] = r._count; }
  res.json({
    total, claimed, withoutCoordinates: noCoords, hidden, lastImport: setting?.value || null,
    categories: Object.keys(CATEGORIES).map((k) => ({ key: k, label: CATEGORIES[k], count: byCat.find((c) => c.category === k)?._count || 0 })),
    sources: bySource.map((s) => ({ key: s.source, label: SOURCES[s.source] || s.source, count: s._count })),
    states: Object.entries(states).map(([state, cats]) => ({ state, total: Object.values(cats).reduce((a, b) => a + b, 0), hospitals: HOSPITALS.reduce((a, c) => a + (cats[c] || 0), 0), clinics: (cats.CLINIC || 0) + (cats.PRIMARY_HEALTH_CENTRE || 0) + (cats.HEALTH_POST || 0) + (cats.MATERNITY || 0), diagnostic: cats.DIAGNOSTIC || 0, bloodBanks: cats.BLOOD_BANK || 0, pharmacies: cats.PHARMACY || 0, teaching: cats.TEACHING_HOSPITAL || 0, hmo: cats.HMO || 0 })).sort((a, b) => a.state.localeCompare(b.state)),
  });
}

/** GET /api/admin-ops/facilities?q=&state=&category=&hidden=1&page= */
export async function adminList(req: Request, res: Response) {
  const q = str(req.query.q, 80);
  const where: any = { hidden: req.query.hidden === '1' };
  const cat = str(req.query.category)?.toUpperCase(); if (cat && CATEGORIES[cat]) where.category = cat;
  const state = str(req.query.state, 40); if (state) where.state = state;
  if (req.query.claimed === '1') where.claimedByUserId = { not: null };
  if (q) where.AND = q.split(/\s+/).filter(Boolean).slice(0, 5).map((w) => ({ name: { contains: w, mode: 'insensitive' } }));
  const page = Math.max(1, Number(req.query.page) || 1);
  const [rows, count] = await Promise.all([prisma.facilityListing.findMany({ where, take: 50, skip: (page - 1) * 50, orderBy: [{ state: 'asc' }, { name: 'asc' }] }), prisma.facilityListing.count({ where })]);
  res.json({ rows: rows.map((f) => ({ ...pub(f), sourceKey: f.source, hidden: f.hidden, claimedAt: f.claimedAt, nhfrCode: f.nhfrCode })), count, page });
}

const editable = (b: any) => {
  const d: any = {};
  for (const k of ['name', 'level', 'ownership', 'ownershipType', 'state', 'lga', 'ward', 'address', 'phone', 'email', 'website', 'functional', 'nhfrCode']) if (b[k] !== undefined) d[k] = str(b[k], 300) ?? null;
  if (b.category !== undefined) { const c = String(b.category).toUpperCase(); if (!CATEGORIES[c]) throw ApiError.badRequest('Unknown category'); d.category = c; }
  for (const k of ['lat', 'lng']) if (b[k] !== undefined) d[k] = num(b[k]) ?? null;
  if (typeof b.hidden === 'boolean') d.hidden = b.hidden;
  return d;
};

/** POST /api/admin-ops/facilities - add a facility missing from the public lists. */
export async function adminCreate(req: Request, res: Response) {
  const d = editable(req.body || {});
  if (!d.name || !d.category) throw ApiError.badRequest('Name and category are required');
  const dup = await prisma.facilityListing.findFirst({ where: { name: { equals: d.name, mode: 'insensitive' }, state: d.state ?? undefined } });
  if (dup && req.body?.force !== true) throw ApiError.conflict(`"${dup.name}" is already listed${dup.state ? ' in ' + dup.state : ''}. Edit it instead, or add anyway.`);
  res.status(201).json(await prisma.facilityListing.create({ data: { ...d, source: 'ADMIN', sourceId: crypto.randomUUID(), addedById: uid(req) } }));
}

/** PATCH /api/admin-ops/facilities/:id - correct or hide a listing (protected from being overwritten by later imports). */
export async function adminUpdate(req: Request, res: Response) {
  const d = editable(req.body || {});
  if (req.body?.unclaim === true) { d.claimedByUserId = null; d.claimedAt = null; }
  res.json(await prisma.facilityListing.update({ where: { id: req.params.id }, data: { ...d, addedById: uid(req) } }));
}
