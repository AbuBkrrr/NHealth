/* Safe production migrations.
 * - Runs `prisma migrate deploy`.
 * - If the database was created earlier with `prisma db push` (error P3005: schema not empty,
 *   no migration history), it baselines the historical migrations as applied and retries.
 * Exits non-zero on failure so the platform keeps the previous healthy deployment. */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const run = (cmd) => execSync(cmd, { stdio: 'pipe', env: process.env, cwd: path.join(__dirname, '..') }).toString();
const BASELINE_UNTIL = '20261101000000_reconcile_schema_drift';
try {
  console.log(run('npx prisma migrate deploy'));
} catch (e) {
  const out = String(e.stdout || '') + String(e.stderr || '');
  if (!out.includes('P3005')) { console.error(out); process.exit(1); }
  console.warn('[migrate] Existing schema without history detected - baselining.');
  const dir = path.join(__dirname, '..', 'prisma', 'migrations');
  const names = fs.readdirSync(dir).filter((n) => fs.statSync(path.join(dir, n)).isDirectory()).sort();
  for (const n of names) {
    if (n > BASELINE_UNTIL) break;
    console.log(run('npx prisma migrate resolve --applied ' + n));
  }
  try { console.log(run('npx prisma migrate deploy')); }
  catch (e2) { console.error(String(e2.stdout || '') + String(e2.stderr || '')); process.exit(1); }
}
