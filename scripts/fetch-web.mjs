#!/usr/bin/env node
// Builds www/ (the web app bundled inside the Android/iOS app) from the live odin-cards website.
// Every file is checked against the sha256 listed in the site's app-update.json.
//   node scripts/fetch-web.mjs            sideload / personal build (Me and Tab's Work stay)
//   node scripts/fetch-web.mjs --store    Google Play build (personal sections hidden)
//   node scripts/fetch-web.mjs --from <site-dir>   build from a local copy of the site instead of the network
//        (e.g. a checkout of the GitHub Pages branch). If that folder has no app-update.json, the file list and
//        checksums are made from the folder itself (also with --gen), and the web version is read from sw.js (cards-vNNN → vNNN).
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), STORE = args.includes('--store'), fi = args.indexOf('--from'), FROM = fi >= 0 ? args[fi + 1] : null;
const SITE = (process.env.ODIN_SITE || 'https://odin-cards.sites.tab.bot').replace(/\/$/, '');
const CFG = JSON.parse(readFileSync(join(ROOT, 'native', 'build.json'), 'utf8')); // { build: <native build number> }
const WWW = join(ROOT, 'www');
const sha = b => createHash('sha256').update(b).digest('hex');
async function get(p) {
  if (FROM) return readFileSync(join(FROM, p));
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(SITE + '/' + p.split('/').map(encodeURIComponent).join('/'), { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return Buffer.from(await r.arrayBuffer()); }
    catch (e) { if (i === 3) throw new Error(p + ': ' + e.message); await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
  }
}
// files of the website that are not part of the app (same list the site's own app-update.json leaves out)
const SKIP_TOP = new Set(['privacy', 'tab-site.json', 'admin-pro', 'chess', 'me', 'worker.js', 'share', 'app-update.json', 'CNAME', 'README.md', 'LICENSE', '404.html']);
const SKIP_PATH = new Set(['native/boot.js']);
function manifestFromDir(dir) {
  const files = [];
  (function walk(d, rel) {
    for (const n of readdirSync(d).sort()) {
      if (n.startsWith('.')) continue;
      const p = rel ? rel + '/' + n : n;
      if (!rel && SKIP_TOP.has(n)) continue;
      if (SKIP_PATH.has(p)) continue;
      const full = join(d, n), s = statSync(full);
      if (s.isDirectory()) walk(full, p); else { const b = readFileSync(full); files.push([p, sha(b), b.length]); }
    }
  })(dir, '');
  let v = 'local';
  try { const m = readFileSync(join(dir, 'sw.js'), 'utf8').match(/cards-(v\d+)/); if (m) v = m[1]; } catch (e) {}
  return { app: 'odin-cards', v, minNative: 1, built: new Date().toISOString(), site: SITE, files };
}
const man = FROM && (args.includes('--gen') || !existsSync(join(FROM, 'app-update.json'))) ? manifestFromDir(FROM)
  : JSON.parse((FROM ? readFileSync(join(FROM, 'app-update.json')) : await get('app-update.json')).toString('utf8'));
rmSync(WWW, { recursive: true, force: true }); mkdirSync(WWW, { recursive: true });
let i = 0, bytes = 0; const q = man.files.slice(), pages = {};
async function worker() {
  while (q.length) {
    const [p, h, size] = q.shift(); const b = await get(p);
    if (sha(b) !== h) throw new Error('checksum mismatch for ' + p + ' (the site changed during the build? run again)');
    const out = join(WWW, p); mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, b);
    if (/\.html$/.test(p)) pages[p] = b.toString('utf8');
    bytes += size; if (++i % 100 === 0) console.log(i + '/' + man.files.length);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
// the page shells load through native/boot.js (applies downloaded updates, then writes the real page)
const files = Object.fromEntries(man.files.map(f => [f[0], f[1]]));
writeFileSync(join(WWW, 'native', 'bundle.json'), JSON.stringify({ v: man.v, files }));
const RESIGN = !STORE && !args.includes('--no-resign'); // re-sign reminder: sideload builds only
writeFileSync(join(WWW, 'native', 'config.js'), 'window.__ODIN_CFG=' + JSON.stringify({ site: SITE, store: STORE, build: CFG.build, v: man.v, resign: RESIGN }) + ';\n');
writeFileSync(join(WWW, 'native', 'pages.js'), 'window.__ODIN_PAGES=' + JSON.stringify(pages).replace(/<\/script/gi, '<\\/script') + ';\n');
copyFileSync(join(ROOT, 'native', 'boot.js'), join(WWW, 'native', 'boot.js'));
if (RESIGN) copyFileSync(join(ROOT, 'native', 'resign.js'), join(WWW, 'native', 'resign.js'));
for (const p of Object.keys(pages)) {
  const up = p.split('/').slice(1).map(() => '..').join('/'), pre = up ? up + '/' : '';
  writeFileSync(join(WWW, p), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"><script src="${pre}native/config.js"></script><script src="${pre}native/pages.js"></script><script src="${pre}native/boot.js"></script></head><body></body></html>\n`);
}
console.log(`www/ ready: web ${man.v}, ${man.files.length} files, ${(bytes / 1e6).toFixed(1)} MB, ${STORE ? 'STORE build (Google Play)' : 'personal build'}`);
