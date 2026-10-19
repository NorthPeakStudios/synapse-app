/* Prefs: one settings store for the whole app (theme, accent, text size, motion, haptics, home layout, per-app options).
   localStorage 'prefs.v1' (same origin, so /chess/ reads it too); the Cards app syncs it through D1 as progress record id 'prefs'. */
(function () {
  'use strict';
  if (window.Prefs) return;
  const KEY = 'prefs.v1';
  const ACCENTS = [['Blue', '#0a84ff'], ['Indigo', '#5e5ce6'], ['Purple', '#bf5af2'], ['Pink', '#ff375f'], ['Red', '#ff453a'], ['Orange', '#ff9f0a'], ['Yellow', '#ffd60a'], ['Green', '#30d158'], ['Mint', '#63e6be'], ['Teal', '#40c8e0'], ['Graphite', '#98989d']];
  const TILE_IDS = ['cards', 'doc', 'anat', 'speak', 'rx', 'lab', 'tools'];
  const DEF = {
    theme: 'dark', accent: '#0a84ff', tint: 'none', uiFont: 'system', myThemes: [], icon: 'default', text: 'm', reduceMotion: 'auto', haptics: true, sounds: false,
    home: { order: TILE_IDS.slice(), hidden: [], style: 'grid', stats: { streak: true, level: true, xp: true, goal: true } },
    cards: { newPerDay: 20, font: 'system' },
    learn: { level: 'hs' },
    doc: { hard: false, timed: false },
    chess: { board: 'green', light: '', dark: '', pieces: 'cburnett' },
    at: 0
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  function merge(base, o) { const out = clone(base); if (!o || typeof o !== 'object') return out; for (const k in base) { if (!(k in o)) continue; if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = merge(base[k], o[k]); else out[k] = o[k]; } return out; }
  function load() { try { return merge(DEF, JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return clone(DEF); } }
  let v = load();
  // keep the tile list valid as tiles come and go
  function fixTiles() { const o = v.home.order.filter(k => TILE_IDS.includes(k)); TILE_IDS.forEach(k => { if (!o.includes(k)) o.push(k); }); v.home.order = o; v.home.hidden = v.home.hidden.filter(k => TILE_IDS.includes(k)); }
  fixTiles();
  const subs = [];
  function save(remote) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} apply(); syncChess(); subs.forEach(f => { try { f(remote); } catch (e) {} }); }
  function set(path, val) {
    const ks = path.split('.'); let o = v; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
    o[ks[ks.length - 1]] = val; v.at = Date.now(); save(false);
  }
  function reset() { v = clone(DEF); v.at = Date.now(); save(false); }
  function fromRemote(data, at) { if (!data || !(at > (v.at || 0))) return false; v = merge(DEF, data); v.at = at; fixTiles(); save(true); return true; }

  /* ---------- apply ---------- */
  const de = document.documentElement;
  const mqDark = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  const mqMotion = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  function themeNow() { return v.theme === 'auto' ? (mqDark && !mqDark.matches ? 'light' : 'dark') : v.theme; }
  function hex(h) { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16); return isFinite(n) && h.length === 6 ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [10, 132, 255]; }
  function lum([r, g, b]) { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); }
  const TEXT = { s: .92, m: 1, l: 1.1, xl: 1.22 };
  const FONTS = { system: '-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif', serif: '"New York","Iowan Old Style",Georgia,serif', rounded: '"SF Pro Rounded",ui-rounded,-apple-system,system-ui,sans-serif', mono: 'ui-monospace,"SF Mono",Menlo,monospace' };
  const TINTS = { // background tints (#39): [dark bg, bg2, card, card2, bar] and the light-mode set
    ocean: [['#07131f', '#0b1a29', '#0f2236', '#173050', 'rgba(7,19,31,.8)'], ['#e9f2fb', '#ffffff', '#ffffff', '#dde9f6', 'rgba(233,242,251,.82)']],
    forest: [['#08140d', '#0c1c12', '#112619', '#1a3324', 'rgba(8,20,13,.8)'], ['#eaf5ee', '#ffffff', '#ffffff', '#dcefe2', 'rgba(234,245,238,.82)']],
    grape: [['#110b1b', '#181026', '#201632', '#2c1e45', 'rgba(17,11,27,.8)'], ['#f1ecfa', '#ffffff', '#ffffff', '#e6ddf6', 'rgba(241,236,250,.82)']],
    sunset: [['#190d0a', '#22120e', '#2c1813', '#3a211a', 'rgba(25,13,10,.8)'], ['#fbefe8', '#ffffff', '#ffffff', '#f6e0d4', 'rgba(251,239,232,.82)']],
    rose: [['#190b12', '#22101a', '#2c1522', '#3a1c2d', 'rgba(25,11,18,.8)'], ['#fbecf2', '#ffffff', '#ffffff', '#f5dbe6', 'rgba(251,236,242,.82)']],
    slate: [['#0e1116', '#141920', '#1a2029', '#232b37', 'rgba(14,17,22,.8)'], ['#eef1f5', '#ffffff', '#ffffff', '#e1e6ee', 'rgba(238,241,245,.82)']]
  };
  function apply() {
    const t = themeNow();
    de.dataset.theme = t;
    const a = hex(v.accent), L = lum(a);
    de.style.setProperty('--acc', v.accent);
    de.style.setProperty('--on-acc', L > .45 ? '#000' : '#fff');
    // on a light page a very light accent needs a darker shade for text
    de.style.setProperty('--acc-tx', t === 'light' && L > .5 ? `rgb(${a.map(c => Math.round(c * .62)).join(',')})` : v.accent);
    de.style.setProperty('--zoom', TEXT[v.text] || 1);
    de.style.setProperty('--card-font', FONTS[v.cards.font] || FONTS.system);
    const tv = TINTS[v.tint] && t !== 'amoled' ? TINTS[v.tint][t === 'light' ? 1 : 0] : null;
    ['--bg', '--bg2', '--card', '--card2', '--bar'].forEach((k, i) => { if (tv) de.style.setProperty(k, tv[i]); else de.style.removeProperty(k); });
    if (v.uiFont && v.uiFont !== 'system' && FONTS[v.uiFont]) de.style.setProperty('--ui-font', FONTS[v.uiFont]); else de.style.removeProperty('--ui-font');
    const rm = v.reduceMotion === 'auto' ? !!(mqMotion && mqMotion.matches) : !!v.reduceMotion;
    de.classList.toggle('reduce-motion', rm);
    const mc = document.querySelector('meta[name=theme-color]');
    // v115: no status-bar-style write here (always "black-translucent", set in index.html); a Customize layout theme owns theme-color, so only classic writes it
    var ltOwns = false; try { ltOwns = !!(window.LT && LT.themeOf && LT.themeOf().c); } catch (e) {}
    if (mc && !ltOwns && !location.pathname.startsWith('/chess')) mc.content = tv && /^#/.test(tv[0]) ? tv[0] : t === 'light' ? '#f2f2f7' : t === 'amoled' ? '#000000' : '#0c0c0e';
    // a layout theme (Customize) owns the colors and the top bar color: put it back on top
    if (window.LT && LT.reapply) try { LT.reapply(); } catch (e) {}
  }
  if (mqDark && mqDark.addEventListener) mqDark.addEventListener('change', () => { if (v.theme === 'auto') { apply(); syncChess(); } });
  // chess (Openings Lab) keeps its own settings; mirror the shared ones into it so it follows the app
  function syncChess() {
    try {
      const S = JSON.parse(localStorage.getItem('ol.settings') || '{}') || {};
      const t = themeNow();
      S.theme = t === 'light' ? 'light' : t === 'amoled' ? 'oled' : 'dark';
      S.accent = v.accent; S.board = v.chess.board || 'green'; S.boardLight = v.chess.light || ''; S.boardDark = v.chess.dark || ''; S.pieces = v.chess.pieces || 'cburnett';
      S.haptics = !!v.haptics; S.reduceMotion = de.classList.contains('reduce-motion');
      localStorage.setItem('ol.settings', JSON.stringify(S));
    } catch (e) {}
  }
  apply(); syncChess();

  /* ---------- haptics + sounds ---------- */
  let hapEl = null;
  function haptic() {
    if (!v.haptics) return;
    try { if (navigator.vibrate) { navigator.vibrate(8); return; } } catch (e) {}
    // iOS 18+: toggling a switch control gives a light system tap
    try {
      if (!hapEl) { hapEl = document.createElement('label'); hapEl.setAttribute('aria-hidden', 'true'); hapEl.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none'; const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1; hapEl.appendChild(i); document.body.appendChild(hapEl); }
      hapEl.click();
    } catch (e) {}
  }
  let ac = null;
  function sound(kind) {
    if (!v.sounds) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const notes = { ok: [660, 880], bad: [220, 180], tap: [520], xp: [523, 659, 784] }[kind] || [520];
      notes.forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + i * .07; o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.12, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + .16); o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + .18); });
    } catch (e) {}
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('button,.btile,[role=button],a.btile')) haptic(); }, true);

  /* ---------- icons (line icons, 24px grid) ---------- */
  const P = {
    cards: '<rect x="3.5" y="6" width="13" height="15" rx="2.5"/><path d="M7.5 3h10A2.5 2.5 0 0 1 20 5.5V17"/>',
    chess: '<path d="M8 21h8M7 18h10l-1-4H8l-1 4z"/><path d="M9 14c0-2 1-3 1-5-1.5-.4-2.5-1.5-2.5-3 0-1.8 1.9-3 4.5-3 3.2 0 5 2.2 5 5.5 0 2.2-.7 3.9-1 5.5"/><circle cx="11" cy="6" r=".6" fill="currentColor"/>',
    doc: '<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/><path d="M5 3h2M13 3h2"/>',
    anat: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7.5v7M8 21l2-6.5h4L16 21M5.5 10.5 12 8.5l6.5 2"/>',
    me: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/>',
    decks: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    learn: '<path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5z"/><path d="M7 10.6V15c1.5 1.5 3 2 5 2s3.5-.5 5-2v-4.4M21 8.5V14"/>',
    library: '<path d="M5 4h3v16H5zM10 4h3v16h-3z"/><path d="m15.2 4.8 2.9-.8 3.3 15.5-2.9.7z"/>',
    weak: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
    add: '<path d="M12 5v14M5 12h14"/>',
    browse: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    stats: '<path d="M5 20V11M10 20V5M15 20v-7M20 20V9"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    steth: '<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/><path d="M4.5 3h3M12.5 3h3"/>',
    bolt: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>',
    flask: '<path d="M9.5 3.5h5M10 3.5v5.2L4.8 18a1.8 1.8 0 0 0 1.6 2.6h11.2a1.8 1.8 0 0 0 1.6-2.6L14 8.7V3.5"/><path d="M7.2 14h9.6"/>',
    pill: '<rect x="3.2" y="8.5" width="17.6" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="m9.5 9.5 5 5"/>',
    brain: '<path d="M12 5.5a3 3 0 0 0-5.6-1.3A3 3 0 0 0 4 8.8a3.3 3.3 0 0 0 .3 5.6A3.2 3.2 0 0 0 8 19.4a2.8 2.8 0 0 0 4 .6m0-14.5a3 3 0 0 1 5.6-1.3A3 3 0 0 1 20 8.8a3.3 3.3 0 0 1-.3 5.6 3.2 3.2 0 0 1-3.7 5 2.8 2.8 0 0 1-4 .6m0-14.5V20"/>',
    speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    turtle: '<path d="M5 15c0-4 3-7 7-7s7 3 7 7z"/><path d="M19 13.5h1.5a1.5 1.5 0 0 0 0-3H19M7 15l-1 3M17 15l1 3"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M10 2.5h4M18.5 6.5l1.5-1.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
    pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
    folder: '<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 10.5h17"/>',
    chev: '<path d="m9 5 7 7-7 7"/>',
    flame: '<path d="M12 21c-3.9 0-7-2.7-7-6.6 0-3.1 2-5.2 3.6-7 .4 2 1.4 3 2.4 3.4C11 7.5 12.6 5 15 3c.4 2.8 4 5.6 4 10.5 0 4.2-3.1 7.5-7 7.5z"/>',
    grip: '<path d="M5 9h14M5 15h14"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 5.6A10 10 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.6M6.6 6.6A17 17 0 0 0 2.5 12s3.5 6.5 9.5 6.5a9.6 9.6 0 0 0 4.4-1"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>'
  };
  function icon(name, size, cls) { const s = size || 22; return `<svg class="ic-svg${cls ? ' ' + cls : ''}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`; }

  window.Prefs = { get v() { return v; }, DEF, ACCENTS, TILE_IDS, set, reset, fromRemote, onChange: f => subs.push(f), apply, themeNow, haptic, sound, icon, FONTS, TINTS };
})();
