import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Writes the list of built files (and a version) into dist/sw.js so the service worker can keep them all for offline use. */
function precacheManifest() {
  let outDir = 'dist';
  return {
    name: 'nhealth-precache-manifest',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const dir = path.resolve(outDir);
      const files = [];
      const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((f) => {
        const p = path.join(d, f.name);
        if (f.isDirectory()) walk(p); else files.push('/' + path.relative(dir, p).split(path.sep).join('/'));
      });
      walk(dir);
      const keep = files.filter((f) => /^\/(assets|icons)\//.test(f) || f === '/manifest.webmanifest').sort();
      const version = crypto.createHash('sha256').update(keep.join('|') + fs.readFileSync(path.join(dir, 'index.html'))).digest('hex').slice(0, 12);
      const sw = path.join(dir, 'sw.js');
      const src = fs.readFileSync(sw, 'utf8');
      if (!src.includes('self.__PRECACHE__')) throw new Error('sw.js is missing the self.__PRECACHE__ placeholder');
      fs.writeFileSync(sw, src.replace('self.__PRECACHE__', JSON.stringify({ version, files: keep })));
    },
  };
}

export default defineConfig({
  build: { outDir: 'dist', sourcemap: false, target: 'es2019', chunkSizeWarningLimit: 900 },
  server: { port: 5173 },
  plugins: [precacheManifest()],
});
