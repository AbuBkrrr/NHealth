/* Loads the Nigerian facility directory (data/facilities-ng.ndjson.gz) into FacilityListing.
 * Runs at every API start (see deploy/docker/api.Dockerfile); it does nothing when this file version was already loaded.
 * - New facilities are added; facilities already listed are updated, except those a provider has claimed or an admin edited.
 * - Nothing is deleted (an admin can hide a listing).
 * Usage: node scripts/import-facilities.cjs [--force] [--file path]
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const readline = require('readline');
const { PrismaClient } = require('@prisma/client');

const args = process.argv.slice(2);
const FILE = args.includes('--file') ? args[args.indexOf('--file') + 1] : path.join(__dirname, '..', 'data', 'facilities-ng.ndjson.gz');
const FORCE = args.includes('--force');
const KEY = 'facilityDirectory';
const COLS = ['name', 'category', 'level', 'ownership', 'ownershipType', 'state', 'lga', 'ward', 'address', 'phone', 'email', 'website', 'lat', 'lng', 'functional', 'nhfrCode'];

(async () => {
  if (!fs.existsSync(FILE)) { console.log('Facility directory: no data file, skipped'); return; }
  const version = crypto.createHash('sha256').update(fs.readFileSync(FILE)).digest('hex').slice(0, 16);
  const prisma = new PrismaClient();
  try {
    const setting = await prisma.platformSetting.findUnique({ where: { key: KEY } }).catch(() => null);
    if (!FORCE && setting?.value?.version === version) { console.log('Facility directory: up to date (' + version + ')'); return; }
    const started = Date.now();
    const rl = readline.createInterface({ input: fs.createReadStream(FILE).pipe(zlib.createGunzip()), crlfDelay: Infinity });
    let batch = [], total = 0, added = 0;
    const flush = async () => {
      if (!batch.length) return;
      const rows = batch; batch = [];
      const r = await prisma.facilityListing.createMany({ data: rows, skipDuplicates: true });
      added += r.count;
      // Refresh listings already there (not claimed, not edited by an admin) in one statement per batch.
      // One JSON parameter per batch, unpacked by PostgreSQL (robust for empty values and decimals).
      await prisma.$executeRawUnsafe(
        `UPDATE "FacilityListing" f SET ${COLS.map((c) => `"${c}" = v."${c}"`).join(', ')}, "updatedAt" = NOW()
         FROM jsonb_to_recordset($1::jsonb) AS v(source text, "sourceId" text, ${COLS.map((c) => `"${c}" ${c === 'lat' || c === 'lng' ? 'float8' : 'text'}`).join(', ')})
         WHERE f.source = v.source AND f."sourceId" = v."sourceId" AND f."claimedByUserId" IS NULL AND f."addedById" IS NULL`,
        JSON.stringify(rows),
      );
    };
    for await (const line of rl) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      const row = { source: String(r.source), sourceId: String(r.sourceId), name: String(r.name).slice(0, 200), category: String(r.category) };
      for (const c of COLS.slice(2)) if (r[c] !== undefined && r[c] !== null) row[c] = c === 'lat' || c === 'lng' ? Number(r[c]) : String(r[c]).slice(0, 300);
      batch.push(row); total++;
      if (batch.length >= 1000) await flush();
    }
    await flush();
    const value = { version, total, importedAt: new Date().toISOString(), sources: 'GRID3 NGA Health Facilities v4.0 (CC BY 4.0); OpenStreetMap via HOT export (ODbL, © OpenStreetMap contributors); NHIA accredited HMOs; NBSA blood centres' };
    await prisma.platformSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
    console.log(`Facility directory: ${total} facilities read, ${added} new, in ${Math.round((Date.now() - started) / 1000)} s`);
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error('Facility directory import failed (the API still starts):', e.message); process.exit(0); });
