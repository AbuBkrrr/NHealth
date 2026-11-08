const fs = require('fs');
const p = 'apps/landing/index.html';
let lines = fs.readFileSync(p, 'utf8').split('\n');
let fixes = 0;

const ID = '753267520396-ucmfbovnvhu42mbc4elgdufl3k52m1fc.apps.googleusercontent.com';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Skip lines that already have the ID quoted
  if (line.includes("'" + ID + "'") || line.includes('"' + ID + '"')) {
    continue;
  }

  // Skip lines that don't contain the ID
  if (!line.includes(ID)) continue;

  // Handle: `if (GOOGLE_CLIENT_ID === <ID>)` → wrap in quotes
  if (line.includes('GOOGLE_CLIENT_ID ===')) {
    lines[i] = line.replace(ID, "'" + ID + "'");
    fixes++;
    console.log('Line ' + (i + 1) + ': quoted GOOGLE_CLIENT_ID comparison');
    continue;
  }

  // Handle: `const GOOGLE_CLIENT_ID = <ID>;` → wrap in quotes
  if (/GOOGLE_CLIENT_ID\s*=\s*/.test(line)) {
    lines[i] = line.replace(ID, "'" + ID + "'");
    fixes++;
    console.log('Line ' + (i + 1) + ': quoted GOOGLE_CLIENT_ID assignment');
    continue;
  }

  // Handle: HTML attribute `client_id=<ID>` → wrap in double quotes
  if (line.includes('client_id=')) {
    lines[i] = line.replace(ID, '"' + ID + '"');
    fixes++;
    console.log('Line ' + (i + 1) + ': quoted client_id attribute');
    continue;
  }

  // Anything else — just wrap in single quotes as a safe fallback
  lines[i] = line.replace(ID, "'" + ID + "'");
  fixes++;
  console.log('Line ' + (i + 1) + ': quoted ID (fallback)');
}

fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log('\nTotal fixes: ' + fixes);

// Verify
const v = fs.readFileSync(p, 'utf8');
const totalId = (v.match(/753267520396-ucmfbovnvhu42mbc4elgdufl3k52m1fc\.apps\.googleusercontent\.com/g) || []).length;
const quotedId = (v.match(/['"]753267520396-ucmfbovnvhu42mbc4elgdufl3k52m1fc\.apps\.googleusercontent\.com['"]/g) || []).length;

console.log('\n=== VERIFICATION ===');
console.log('Total occurrences: ' + totalId);
console.log('Quoted occurrences: ' + quotedId);
console.log('Unquoted remaining: ' + (totalId - quotedId));
console.log(totalId === quotedId ? '\n✅ ALL CLIENT IDS QUOTED' : '\n❌ SOME UNQUOTED — check the file manually');