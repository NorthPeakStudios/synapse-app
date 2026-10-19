/* Layout themes (feat/layout/themes.js): the look half of Customize. Loaded in <head> so the saved theme paints first.
   window.LT = { THEMES, TOKENS, apply(state?), state(), tokensOf(themeId, state) }. Tokens become CSS variables on <html>;
   the rest of the app already draws from those variables (theme.css). 'classic' leaves Settings > Appearance in charge. */
(function () {
  'use strict';
  if (window.LT) return;
  var KEY = 'layout.v1', de = document.documentElement;
  var SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif', SANS = '-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",system-ui,sans-serif';
  var ROUND = '"SF Pro Rounded",ui-rounded,-apple-system,system-ui,sans-serif', MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';
  var FONTS = { sans: SANS, serif: SERIF, rounded: ROUND, mono: MONO };
  // editable tokens: [key, label, css variable]
  var TOKENS = [
    ['bg', 'Background', '--bg'], ['bg2', 'Background 2 (sheets)', '--bg2'], ['card', 'Cards and panels', '--card'], ['card2', 'Cards, second level', '--card2'],
    ['tx', 'Text', '--tx'], ['mut', 'Muted text', '--mut'], ['line', 'Borders and dividers', '--line'], ['acc', 'Accent and buttons', '--acc'], ['onacc', 'Text on accent', '--on-acc'],
    ['bar', 'Top bar and tab bar', '--lt-bar'], ['drawer', 'Menu background', '--lt-drawer'], ['hl', 'Highlight', '--lt-hl'],
    ['g1', 'Menu group 1', '--lt-g1'], ['g2', 'Menu group 2', '--lt-g2'], ['g3', 'Menu group 3', '--lt-g3'], ['g4', 'Menu group 4', '--lt-g4'], ['g5', 'Menu group 5', '--lt-g5'],
    ['again', 'Again button', '--again'], ['hard', 'Hard button', '--hard'], ['good', 'Good button', '--good'], ['easy', 'Easy button', '--easy'],
    ['due', 'Due count', '--due'], ['new', 'New count', '--new']
  ];
  function T(name, mode, c, o) { o = o || {}; o.name = name; o.mode = mode; o.c = c; return o; }
  // c = { bg, bg2, card, card2, tx, mut, line, acc, onacc, bar, drawer, hl, g1..g5, again, hard, good, easy, due, new }
  var THEMES = {
    classic: { name: 'Classic', mode: '', c: null, desc: 'Follows Settings > Appearance' },
    notebook: T('Notebook', 'light', { bg: '#f6f0e1', bg2: '#fbf6ea', card: '#fffdf6', card2: '#f3ecda', tx: '#25264a', mut: '#7a7466', line: '#d9cfb6', acc: '#2b3a8c', onacc: '#fffdf6', bar: '#f6f0e1', drawer: '#fffdf6', hl: '#fbe7a1', g1: '#2b3a8c', g2: '#b5651d', g3: '#2f7a4a', g4: '#6b4fa0', g5: '#b3261e', again: '#b3261e', hard: '#b5651d', good: '#2f7a4a', easy: '#2b3a8c', due: '#2f7a4a', new: '#2b3a8c' }, { font: 'sans', head: 'serif', r: 6, shadow: 'hard', sh: '#e2d8bf', deco: 'notebook', desc: 'Cream paper, ruled cards, serif headings' }),
    clinical: T('Clinical', 'light', { bg: '#f5f9fa', bg2: '#ffffff', card: '#ffffff', card2: '#eef4f5', tx: '#12212b', mut: '#5d6f78', line: '#dce6e9', acc: '#0f8f80', onacc: '#ffffff', bar: '#f5f9fa', drawer: '#ffffff', hl: '#d6f2ee', g1: '#0f8f80', g2: '#3b82c4', g3: '#7a5cc4', g4: '#d0811f', g5: '#c74255', again: '#d64545', hard: '#d0811f', good: '#0f8f80', easy: '#3b82c4', due: '#0f8f80', new: '#3b82c4' }, { font: 'sans', head: 'sans', r: 16, shadow: 'soft', deco: 'none', desc: 'White, teal, soft cards' }),
    neon: T('OLED Neon', 'dark', { bg: '#000000', bg2: '#0a0a0a', card: '#0d0d0d', card2: '#161616', tx: '#f4f4f4', mut: '#8b8b8b', line: '#262626', acc: '#c6ff3d', onacc: '#000000', bar: '#000000', drawer: '#060606', hl: '#2a3a00', g1: '#c6ff3d', g2: '#3df2ff', g3: '#ff3df2', g4: '#ffb03d', g5: '#ff4d6d', again: '#ff4d6d', hard: '#ffb03d', good: '#c6ff3d', easy: '#3df2ff', due: '#c6ff3d', new: '#3df2ff' }, { font: 'sans', head: 'sans', r: 14, shadow: 'glow', deco: 'neon', desc: 'True black, lime glow' }),
    glass: T('Glass', 'dark', { bg: '#14113a', bg2: '#1d1a4a', card: 'rgba(255,255,255,.09)', card2: 'rgba(255,255,255,.14)', tx: '#f3f1ff', mut: '#b2acd8', line: 'rgba(255,255,255,.16)', acc: '#8fd3ff', onacc: '#0b1030', bar: 'rgba(20,17,58,.6)', top: '#1c1a4c', drawer: 'rgba(30,26,80,.82)', hl: 'rgba(143,211,255,.22)', g1: '#8fd3ff', g2: '#c9a7ff', g3: '#7ef0c2', g4: '#ffc58f', g5: '#ff9ac1', again: '#ff8a9a', hard: '#ffc58f', good: '#7ef0c2', easy: '#8fd3ff', due: '#7ef0c2', new: '#8fd3ff' }, { font: 'sans', head: 'sans', r: 22, shadow: 'soft', deco: 'glass', desc: 'Frosted panels over a deep gradient' }),
    brutalist: T('Brutalist', 'light', { bg: '#fffbea', bg2: '#ffffff', card: '#ffffff', card2: '#fff1b8', tx: '#000000', mut: '#3d3d3d', line: '#000000', acc: '#ff5c00', onacc: '#000000', bar: '#fffbea', drawer: '#ffffff', hl: '#ffe14d', g1: '#ff5c00', g2: '#2f6bff', g3: '#00b36b', g4: '#ffcf00', g5: '#ff2e63', again: '#ff2e63', hard: '#ffcf00', good: '#00b36b', easy: '#2f6bff', due: '#00b36b', new: '#2f6bff' }, { font: 'sans', head: 'sans', r: 0, shadow: 'brutal', deco: 'brutal', desc: 'Thick borders, flat colors, hard shadows' }),
    pastel: T('Pastel', 'light', { bg: '#fbf5ff', bg2: '#ffffff', card: '#ffffff', card2: '#f3eafd', tx: '#3d3554', mut: '#857c9c', line: '#ece2f7', acc: '#9b6ce0', onacc: '#ffffff', bar: '#fbf5ff', drawer: '#ffffff', hl: '#ffe4f1', g1: '#9b6ce0', g2: '#f28fb1', g3: '#5cc4a6', g4: '#f5b45f', g5: '#6aa8f0', again: '#f07a8f', hard: '#f5b45f', good: '#5cc4a6', easy: '#6aa8f0', due: '#5cc4a6', new: '#6aa8f0' }, { font: 'rounded', head: 'rounded', r: 24, shadow: 'soft', deco: 'none', desc: 'Soft colors, round shapes' }),
    chart: T('Medical Chart', 'light', { bg: '#f3f7f2', bg2: '#ffffff', card: '#ffffff', card2: '#eaf1e8', tx: '#1f2d24', mut: '#5f7064', line: '#c9d8c9', acc: '#c0392b', onacc: '#ffffff', bar: '#f3f7f2', drawer: '#ffffff', hl: '#fde2df', g1: '#c0392b', g2: '#1f6f8b', g3: '#2e7d32', g4: '#8e5ab5', g5: '#d68910', again: '#c0392b', hard: '#d68910', good: '#2e7d32', easy: '#1f6f8b', due: '#2e7d32', new: '#1f6f8b' }, { font: 'sans', head: 'mono', r: 4, shadow: 'none', deco: 'chart', desc: 'Graph paper and chart labels' }),
    premium: T('Premium', 'dark', { bg: '#0b1026', bg2: '#11183a', card: '#141b3a', card2: '#1c2550', tx: '#eef0ff', mut: '#9aa3cf', line: '#273163', acc: '#7c6cff', onacc: '#ffffff', bar: '#0b1026', drawer: '#11183a', hl: '#2a2470', g1: '#7c6cff', g2: '#c04bff', g3: '#36d1c4', g4: '#ffb547', g5: '#ff5f8f', again: '#ff5f8f', hard: '#ffb547', good: '#36d1c4', easy: '#7c6cff', due: '#36d1c4', new: '#7c6cff' }, { font: 'sans', head: 'sans', r: 18, shadow: 'soft', deco: 'gradient', grad: 'linear-gradient(135deg,#6a5cff,#c04bff)', desc: 'Deep navy, gradient buttons' }),
    ios: T('iOS Native', 'light', { bg: '#f2f2f7', bg2: '#ffffff', card: '#ffffff', card2: '#f2f2f7', tx: '#111113', mut: '#6c6c70', line: '#dcdce1', acc: '#007aff', onacc: '#ffffff', bar: '#f2f2f7', drawer: '#ffffff', hl: '#d9e9ff', g1: '#007aff', g2: '#ff9500', g3: '#34c759', g4: '#af52de', g5: '#ff3b30', again: '#ff3b30', hard: '#ff9500', good: '#34c759', easy: '#007aff', due: '#34c759', new: '#007aff' }, { font: 'sans', head: 'sans', r: 12, shadow: 'none', deco: 'none', desc: 'Grouped lists, large titles, blue' }),
    terminal: T('Terminal', 'dark', { bg: '#000000', bg2: '#030a03', card: '#041004', card2: '#082008', tx: '#39ff6a', mut: '#1fae47', line: '#0f4a1c', acc: '#39ff6a', onacc: '#000000', bar: '#000000', drawer: '#020802', hl: '#0d3a17', g1: '#39ff6a', g2: '#39ff6a', g3: '#39ff6a', g4: '#39ff6a', g5: '#39ff6a', again: '#ff5555', hard: '#ffd75f', good: '#39ff6a', easy: '#5fd7ff', due: '#39ff6a', new: '#5fd7ff' }, { font: 'mono', head: 'mono', r: 0, shadow: 'none', deco: 'terminal', desc: 'Green text on black, all monospace' }),
    midnight: T('Midnight Ink', 'dark', { bg: '#0f1424', bg2: '#151b30', card: '#18203a', card2: '#222b4a', tx: '#ece6d6', mut: '#9a9db3', line: '#2a3352', acc: '#e8b44c', onacc: '#1a1405', bar: '#0f1424', drawer: '#151b30', hl: '#3a3218', g1: '#e8b44c', g2: '#7fb0ff', g3: '#8fd19e', g4: '#c79bff', g5: '#ff8c7a', again: '#ff7a6b', hard: '#e8b44c', good: '#8fd19e', easy: '#7fb0ff', due: '#8fd19e', new: '#7fb0ff' }, { font: 'sans', head: 'serif', r: 10, shadow: 'soft', deco: 'none', desc: 'Navy and gold, serif titles' }),
    sepia: T('Sepia Reader', 'light', { bg: '#f1e7d3', bg2: '#f8f0df', card: '#fbf4e4', card2: '#efe3c9', tx: '#3b2a1a', mut: '#7d6650', line: '#dccbaa', acc: '#8a4b2a', onacc: '#fbf4e4', bar: '#f1e7d3', drawer: '#fbf4e4', hl: '#f3d9a6', g1: '#8a4b2a', g2: '#5d6b2f', g3: '#2f5d6b', g4: '#6b2f5d', g5: '#a3542a', again: '#a33a2a', hard: '#b0782a', good: '#5d6b2f', easy: '#2f5d6b', due: '#5d6b2f', new: '#2f5d6b' }, { font: 'serif', head: 'serif', r: 8, shadow: 'none', deco: 'none', desc: 'Warm paper for long reading' }),
    forest: T('Forest', 'dark', { bg: '#0d1813', bg2: '#12211a', card: '#152820', card2: '#1d362a', tx: '#e4f2ea', mut: '#8fae9c', line: '#24402f', acc: '#6fcf97', onacc: '#06140c', bar: '#0d1813', drawer: '#12211a', hl: '#1f4a33', g1: '#6fcf97', g2: '#e2b65c', g3: '#7cc4e8', g4: '#c59be0', g5: '#ef8a72', again: '#ef7a6a', hard: '#e2b65c', good: '#6fcf97', easy: '#7cc4e8', due: '#6fcf97', new: '#7cc4e8' }, { font: 'sans', head: 'sans', r: 14, shadow: 'none', deco: 'none', desc: 'Deep green, calm at night' }),
    sakura: T('Sakura', 'light', { bg: '#fff4f6', bg2: '#ffffff', card: '#ffffff', card2: '#ffe6ec', tx: '#3a2230', mut: '#8e6b7b', line: '#f6d6df', acc: '#e0507e', onacc: '#ffffff', bar: '#fff4f6', drawer: '#ffffff', hl: '#ffdbe6', g1: '#e0507e', g2: '#8f6ad8', g3: '#3fae8c', g4: '#e59a3c', g5: '#4f8fe0', again: '#e04f5f', hard: '#e59a3c', good: '#3fae8c', easy: '#4f8fe0', due: '#3fae8c', new: '#4f8fe0' }, { font: 'rounded', head: 'serif', r: 18, shadow: 'soft', deco: 'none', desc: 'Light pink with rose accents' }),
    ocean: T('Ocean', 'light', { bg: '#eaf4fb', bg2: '#ffffff', card: '#ffffff', card2: '#dcecf7', tx: '#0d2a3d', mut: '#557589', line: '#cfe2ee', acc: '#0077b6', onacc: '#ffffff', bar: '#eaf4fb', drawer: '#ffffff', hl: '#caeaff', g1: '#0077b6', g2: '#00a6a6', g3: '#4caf50', g4: '#7e57c2', g5: '#ef6c57', again: '#e5534b', hard: '#f0a33a', good: '#22a06b', easy: '#0077b6', due: '#22a06b', new: '#0077b6' }, { font: 'sans', head: 'sans', r: 16, shadow: 'soft', deco: 'none', desc: 'Sky blue and white' }),
    slate: T('Slate Pro', 'dark', { bg: '#1a1d24', bg2: '#21252e', card: '#252a34', card2: '#2e3440', tx: '#e6e9ef', mut: '#9aa3b2', line: '#363c48', acc: '#7aa2f7', onacc: '#0d1220', bar: '#1a1d24', drawer: '#21252e', hl: '#2f3b57', g1: '#7aa2f7', g2: '#bb9af7', g3: '#9ece6a', g4: '#e0af68', g5: '#f7768e', again: '#f7768e', hard: '#e0af68', good: '#9ece6a', easy: '#7aa2f7', due: '#9ece6a', new: '#7aa2f7' }, { font: 'sans', head: 'sans', r: 10, shadow: 'none', deco: 'none', desc: 'Gray workspace, soft colors' }),
    sunset: T('Sunset', 'dark', { bg: '#1c1110', bg2: '#251614', card: '#2b1a17', card2: '#3a231f', tx: '#fbe9e2', mut: '#c39b8e', line: '#47302a', acc: '#ff7a45', onacc: '#1c0b05', bar: '#1c1110', drawer: '#251614', hl: '#4a2a1c', g1: '#ff7a45', g2: '#ffc145', g3: '#ff4f7b', g4: '#b98cff', g5: '#5ed3c3', again: '#ff4f5e', hard: '#ffc145', good: '#5ed3c3', easy: '#ff7a45', due: '#5ed3c3', new: '#ffc145' }, { font: 'sans', head: 'sans', r: 16, shadow: 'soft', deco: 'gradient', grad: 'linear-gradient(135deg,#ff7a45,#ff4f7b)', desc: 'Warm dark with orange gradients' }),
    contrast: T('High Contrast', 'dark', { bg: '#000000', bg2: '#000000', card: '#111111', card2: '#1e1e1e', tx: '#ffffff', mut: '#e0e0e0', line: '#ffffff', acc: '#ffd60a', onacc: '#000000', bar: '#000000', drawer: '#000000', hl: '#4d4000', g1: '#ffd60a', g2: '#5ac8fa', g3: '#4cd964', g4: '#ff9f0a', g5: '#ff6b6b', again: '#ff6b6b', hard: '#ff9f0a', good: '#4cd964', easy: '#5ac8fa', due: '#4cd964', new: '#5ac8fa' }, { font: 'sans', head: 'sans', r: 10, shadow: 'none', deco: 'contrast', desc: 'Maximum contrast, bold outlines' }),
    atlas: T('Anatomy Atlas', 'light', { bg: '#f4ecdf', bg2: '#fbf6ee', card: '#fdf9f2', card2: '#efe4d2', tx: '#2a1d17', mut: '#7a6656', line: '#ddcdb6', acc: '#7b1e1e', onacc: '#fdf9f2', bar: '#f4ecdf', drawer: '#fdf9f2', hl: '#f1d3c8', g1: '#7b1e1e', g2: '#1e4f7b', g3: '#3d6b2a', g4: '#6b3d7b', g5: '#a35d1e', again: '#9e2a2a', hard: '#a35d1e', good: '#3d6b2a', easy: '#1e4f7b', due: '#3d6b2a', new: '#1e4f7b' }, { font: 'serif', head: 'serif', r: 4, shadow: 'hard', sh: '#d8c7ad', deco: 'notebook', desc: 'Parchment and deep red, like an old atlas' }),
    arctic: T('Arctic Night', 'dark', { bg: '#2e3440', bg2: '#343b48', card: '#3b4252', card2: '#434c5e', tx: '#eceff4', mut: '#aeb7c6', line: '#4c566a', acc: '#88c0d0', onacc: '#1d232c', bar: '#2e3440', drawer: '#343b48', hl: '#3f5466', g1: '#88c0d0', g2: '#b48ead', g3: '#a3be8c', g4: '#ebcb8b', g5: '#d08770', again: '#bf616a', hard: '#ebcb8b', good: '#a3be8c', easy: '#81a1c1', due: '#a3be8c', new: '#81a1c1' }, { font: 'sans', head: 'sans', r: 12, shadow: 'none', deco: 'none', desc: 'Cool blue-gray, low glare' })
  };
  var ORDER = ['notebook', 'clinical', 'neon', 'glass', 'brutalist', 'pastel', 'chart', 'premium', 'ios', 'terminal', 'midnight', 'sepia', 'forest', 'sakura', 'ocean', 'slate', 'sunset', 'contrast', 'atlas', 'arctic', 'classic'];
  function state() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } }
  function hex(h) { h = String(h || '').trim(); var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h); if (!m) return null; h = m[1]; if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lum(c) { var f = function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); }
  function mix(a, b, p) { return 'color-mix(in srgb,' + a + ' ' + p + '%,' + b + ')'; }
  // the theme a state points at: built-in, or a saved custom theme ({ id:'c-…', name, base, mode, c, font, head, r, shadow, deco })
  function themeOf(s) {
    s = s || state(); var id = s.theme || 'notebook';
    if (id.indexOf('c-') === 0) { var c = (s.custom || []).filter(function (x) { return x && x.id === id; })[0]; if (c) { var b = THEMES[c.base] || THEMES.notebook; var o = {}; for (var k in b) o[k] = b[k]; for (k in c) if (c[k] != null && k !== 'c') o[k] = c[k]; o.c = {}; for (k in (b.c || {})) o.c[k] = b.c[k]; for (k in (c.c || {})) if (c.c[k]) o.c[k] = c.c[k]; return o; } id = 'notebook'; }
    return THEMES[id] || THEMES.notebook;
  }
  // iOS home-screen status bar: light themes get "default" (bar painted in the page color, dark clock/battery);
  // dark themes get "black-translucent" (white clock/battery). iOS reads this when the app launches, so a theme
  // change shows up in the status bar on the next launch. Runs in <head> before first paint.
  function sbStyle(dark) { try { var m = document.querySelector('meta[name=apple-mobile-web-app-status-bar-style]'); var v = dark ? 'black-translucent' : 'default'; if (m && m.content !== v) m.content = v; } catch (e) {} }
  var SET = [];
  function setVar(k, v) { de.style.setProperty(k, v); if (SET.indexOf(k) < 0) SET.push(k); }
  function clearVars() { SET.forEach(function (k) { de.style.removeProperty(k); }); SET = []; }
  var RAD = { sharp: 2, soft: 10, round: 18, pill: 26 }, ZOOM = { s: .92, m: 1, l: 1.1, xl: 1.22 };
  var busy = false, last = null;
  function apply(s) {
    if (busy) return; busy = true;
    try { applyNow(s); } finally { busy = false; }
  }
  // Settings (prefs.js) re-applies its own colors on some changes; this puts the active layout theme back on top
  function reapply() { if (!busy) apply(last || undefined); }
  function applyNow(s) {
    s = s || state(); last = s; var th = themeOf(s);
    clearVars();
    if (!th.c) { // classic: Settings > Appearance owns colors
      delete de.dataset.lt; delete de.dataset.ltDeco; de.dataset.ltMode = de.dataset.theme || 'dark';
      if (window.Prefs && Prefs.apply) try { Prefs.apply(); } catch (e) {}
    } else {
      var c = th.c, dark = th.mode === 'dark';
      de.dataset.theme = dark ? (c.bg === '#000000' ? 'amoled' : 'dark') : 'light'; de.dataset.ltMode = dark ? 'dark' : 'light';
      de.dataset.lt = String(s.theme || 'notebook').indexOf('c-') === 0 ? 'custom' : (s.theme || 'notebook'); de.dataset.ltDeco = th.deco || 'none';
      setVar('--bg', c.bg); setVar('--bg2', c.bg2 || c.bg); setVar('--card', c.card); setVar('--card2', c.card2 || mix(c.card, c.tx, 94));
      setVar('--tx', c.tx); setVar('--mut', c.mut); setVar('--mut2', mix(c.mut, c.bg, 60));
      setVar('--line', c.line); setVar('--line2', mix(c.line, c.tx, 75)); setVar('--fill', mix(c.tx, 'transparent', 7)); setVar('--fill2', mix(c.tx, 'transparent', 12));
      setVar('--bar', c.bar || c.bg); setVar('--lt-bar', c.bar || c.bg); setVar('--lt-drawer', c.drawer || c.card); setVar('--lt-hl', c.hl || mix(c.acc, 'transparent', 20));
      ['g1', 'g2', 'g3', 'g4', 'g5'].forEach(function (g) { setVar('--lt-' + g, c[g] || c.acc); });
      ['again', 'hard', 'good', 'easy', 'due', 'new'].forEach(function (k) { if (c[k]) setVar('--' + k, c[k]); });
      setVar('--lrn', c.hard || c.acc);
      var sh = th.shadow === 'hard' ? '2px 3px 0 ' + (th.sh || c.line) : th.shadow === 'brutal' ? '4px 4px 0 ' + c.tx : th.shadow === 'glow' ? '0 0 0 1px ' + mix(c.acc, 'transparent', 35) + ',0 0 18px ' + mix(c.acc, 'transparent', 18) : th.shadow === 'soft' ? '0 1px 2px rgba(0,0,0,.06),0 6px 18px rgba(0,0,0,.06)' : 'none';
      setVar('--shadow', sh); setVar('--lt-shadow', sh);
      setVar('--ui-font', FONTS[th.font] || SANS); setVar('--lt-head', FONTS[th.head] || FONTS[th.font] || SANS); setVar('--card-font', FONTS[th.font === 'mono' ? 'mono' : th.head === 'serif' ? 'serif' : th.font] || SANS);
      if (th.grad) setVar('--lt-grad', th.grad);
      var acc = s.accent && hex(s.accent) ? s.accent : c.acc; var a = hex(acc);
      setVar('--acc', acc); setVar('--acc-tx', a && !dark && lum(a) > .5 ? 'rgb(' + a.map(function (v) { return Math.round(v * .6); }).join(',') + ')' : acc);
      setVar('--on-acc', s.accent && a ? (lum(a) > .45 ? '#000' : '#fff') : (c.onacc || '#fff'));
      setVar('--acc-soft', mix(acc, 'transparent', 16));
      var r = th.r == null ? 14 : +th.r;
      setVar('--r', r + 'px'); setVar('--r-sm', Math.max(0, Math.round(r * .75)) + 'px'); setVar('--lt-r', r + 'px');
      var mc = document.querySelector('meta[name=theme-color]'), top = /^#/.test(c.top || '') ? c.top : /^#/.test(c.bar || '') ? c.bar : c.bg; if (mc && /^#/.test(top || '')) mc.content = top;
      sbStyle(dark);
    }
    // shape + size choices apply to every theme, classic included
    if (s.corners && RAD[s.corners] != null) { var rr = RAD[s.corners]; setVar('--r', rr + 'px'); setVar('--r-sm', Math.round(rr * .75) + 'px'); setVar('--lt-r', rr + 'px'); }
    if (s.text && ZOOM[s.text]) setVar('--zoom', ZOOM[s.text]);
    if (s.accent && !th.c && hex(s.accent)) { setVar('--acc', s.accent); setVar('--acc-tx', s.accent); }
    de.classList.toggle('lt-compact', s.density === 'compact');
    de.classList.add('lt-themed');
  }
  window.LT = { sbStyle: sbStyle, THEMES: THEMES, ORDER: ORDER, TOKENS: TOKENS, FONTS: FONTS, KEY: KEY, state: state, apply: apply, reapply: reapply, themeOf: themeOf, hex: hex, lum: lum };
  try { apply(); } catch (e) {}
  // Settings (prefs.js) writes its own colors when it starts; the saved layout theme goes back on top once every script has run
  document.addEventListener('DOMContentLoaded', function () { try { apply(); } catch (e) {} });
})();
