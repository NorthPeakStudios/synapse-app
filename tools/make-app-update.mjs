#!/usr/bin/env node
// Writes <site>/app-update.json: the list of every file the app bundles, with sha256 and size.
// The app's self-updater and the cloud build (scripts/fetch-web.mjs) both read it from the live site.
// Usage: node tools/make-app-update.mjs <site-dir>
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
const site = process.argv[2]; if (!site) { console.error('usage: make-app-update.mjs <site-dir>'); process.exit(2); }
// not part of the app: other apps on the same host, server code, web-only pages, files made per build
const SKIP = [/^chess\//, /^me\//, /^share\//, /^privacy\//, /^admin-pro\//, /^dev\//, /^worker\.js$/, /^tab-site\.json$/, /^app-update\.json$/, /^native\/(boot|config|pages)\.js$/, /^native\/bundle\.json$/, /(^|\/)\./, /\.md$/];
const files = [];
(function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n), s = statSync(p); if (s.isDirectory()) walk(p); else { const r = relative(site, p).split('\\').join('/'); if (!SKIP.some(x => x.test(r))) files.push([r, createHash('sha256').update(readFileSync(p)).digest('hex'), s.size]); } } })(site);
files.sort((a, b) => a[0] < b[0] ? -1 : 1);
const sw = readFileSync(join(site, 'sw.js'), 'utf8'), m = sw.match(/CACHE\s*=\s*'cards-v(\d+)'/);
const out = { app: 'odin-cards', v: m ? 'v' + m[1] : 'v0', minNative: 1, built: new Date().toISOString(), site: 'https://odin-cards.sites.tab.bot', files };
writeFileSync(join(site, 'app-update.json'), JSON.stringify(out));
console.log(out.v, files.length, 'files', (files.reduce((a, f) => a + f[2], 0) / 1e6).toFixed(1) + ' MB');
