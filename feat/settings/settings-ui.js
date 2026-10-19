/* Settings screen (feat/settings/settings-ui.js): iOS-style grouped lists, search, sliding sub-pages.
   window.SettingsUI = { render(el?), open(pageId), count() }. Renders into #v-prefs (or the element given). Reads/writes window.Settings. */
(function () {
  'use strict';
  if (window.SettingsUI) return;
  const G = k => Settings.get(k), SET = (k, v) => Settings.set(k, v);
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const XI = {
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 0 1 4.86.83c0 1.67-2.46 2.3-2.46 3.7"/><path d="M12 17h.01"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11.5" r=".9" fill="currentColor"/><circle cx="10.5" cy="7.5" r=".9" fill="currentColor"/><circle cx="15.2" cy="7.8" r=".9" fill="currentColor"/>',
    home: '<path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z"/>',
    nav: '<path d="M4 6.5h16M4 12h10M4 17.5h16"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    access: '<circle cx="12" cy="4.6" r="1.7"/><path d="m5 8.5 7 1.5 7-1.5M12 10v4.5M9 21l3-6.5 3 6.5"/>',
    data: '<ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.7v.1"/>',
    book: '<path d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v13H7.5A2.5 2.5 0 0 1 5 17.5z"/><path d="M5 17.5A2.5 2.5 0 0 1 7.5 15H19"/>',
    wave: '<path d="M4 12h2M8 8v8M12 5v14M16 9v6M20 11v2"/>',
    x: '<path d="m6 6 12 12M18 6 6 18"/>',
    up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>'
  };
  const I = (n, s) => XI[n] ? `<svg class="ic-svg" width="${s || 20}" height="${s || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${XI[n]}</svg>` : Prefs.icon(n, s || 20);

  /* ---------- row builders (each registers itself for search) ---------- */
  let IDX = null, CUR = '';
  const reg = (label, sub, key) => { if (IDX) IDX.push({ label, sub: sub || '', key: key || '', page: CUR }); return ` data-lbl="${E(label)}"`; };
  const sub_ = s => s ? `<small>${s}</small>` : '';
  function tog(k, label, sub) { const on = !!G(k); return `<div class="prow st-row"${reg(label, sub, k)}><span class="prow-l"><span>${E(label)}</span>${sub_(sub)}</span><button type="button" class="sw${on ? ' on' : ''}" role="switch" aria-checked="${on}" aria-label="${E(label)}" data-s-tog="${k}"><i></i></button></div>`; }
  function seg(k, label, opts, sub) { const v = G(k); return `<div class="prow col st-row"${reg(label, sub, k)}><span class="prow-l"><span>${E(label)}</span>${sub_(sub)}</span><div class="pseg st-seg" role="radiogroup" aria-label="${E(label)}">${opts.map(([val, l]) => `<button type="button" role="radio" aria-checked="${String(v) === String(val)}" class="${String(v) === String(val) ? 'on' : ''}" data-s-seg="${k}" data-v="${E(JSON.stringify(val))}">${E(l)}</button>`).join('')}</div></div>`; }
  function sel(k, label, opts, sub) { const v = G(k), cur = opts.find(o => String(o[0]) === String(v)); return `<label class="prow st-row st-sel"${reg(label, sub, k)}><span class="prow-l"><span>${E(label)}</span>${sub_(sub)}</span><span class="st-val">${E(cur ? cur[1] : v)}</span>${I('chev', 14)}<select data-s-sel="${k}" aria-label="${E(label)}">${opts.map(([val, l]) => `<option value="${E(JSON.stringify(val))}"${String(val) === String(v) ? ' selected' : ''}>${E(l)}</option>`).join('')}</select></label>`; }
  function range(k, label, min, max, step, fmt, sub) { const v = +G(k); return `<div class="prow col st-row"${reg(label, sub, k)}><span class="prow-l st-rl"><span>${E(label)}</span><b class="st-rv" data-rv="${k}">${E(fmt(v))}</b></span><input type="range" class="st-range" min="${min}" max="${max}" step="${step}" value="${v}" data-s-range="${k}" aria-label="${E(label)}">${sub ? `<small class="st-rsub">${sub}</small>` : ''}</div>`; }
  function time(k, label, sub, offable) { const v = G(k); return `<div class="prow st-row"${reg(label, sub, k)}><span class="prow-l"><span>${E(label)}</span>${sub_(sub)}</span><span class="prow-c">${offable && v ? `<button type="button" class="st-clear" data-s-clear="${k}" aria-label="Turn off">${I('x', 16)}</button>` : ''}<input type="time" class="st-time${v ? '' : ' empty'}" value="${E(v)}" data-s-time="${k}" aria-label="${E(label)}">${offable && !v ? '<span class="st-off">Off</span>' : ''}</span></div>`; }
  function nav(pg, label, icon, detail) { reg(label, '', ''); return `<button type="button" class="prow act st-row st-nav" data-s-nav="${pg}" data-lbl="${E(label)}">${icon ? `<span class="st-ic">${I(icon, 18)}</span>` : ''}<span class="st-nl">${E(label)}</span><span class="st-val">${E(detail || '')}</span>${I('chev', 14)}</button>`; }
  function act(name, label, cls, sub) { return `<button type="button" class="prow act st-row st-act ${cls || ''}" data-s-act="${name}"${reg(label, sub, '')}><span class="prow-l"><span>${E(label)}</span>${sub_(sub)}</span></button>`; }
  function info(label, val, id) { return `<div class="prow st-row"${reg(label, '', '')}><span>${E(label)}</span><span class="st-val"${id ? ` id="${id}"` : ''}>${val}</span></div>`; }
  const group = (title, rows, foot) => `${title ? `<h3 class="st-gh">${E(title)}</h3>` : ''}<div class="pgroup st-g">${rows}</div>${foot ? `<p class="st-gf">${foot}</p>` : ''}`;

  const ACC = () => Prefs.ACCENTS;
  const BOARDS = [['green', 'Green'], ['brown', 'Brown'], ['blue', 'Blue'], ['gray', 'Gray'], ['wood', 'Wood'], ['ice', 'Ice'], ['mint', 'Mint'], ['rose', 'Rose'], ['purple', 'Purple']];
  const PIECES = ['cburnett', 'merida', 'california', 'cardinal', 'chessnut', 'companion', 'fresca', 'kosal', 'maestro', 'staunty', 'tatiana'];
  const LEVELS = [['kid', "Like I'm 5"], ['hs', 'High school'], ['college', 'College'], ['phd', 'PhD'], ['expert', 'Expert']];
  const SYSTEMS = [['skin', 'Skin & surface'], ['muscular', 'Muscular'], ['skeletal', 'Skeletal'], ['nervous', 'Nervous'], ['cardiovascular', 'Cardiovascular'], ['respiratory', 'Respiratory'], ['digestive', 'Digestive'], ['urinary', 'Urinary'], ['endocrine', 'Endocrine'], ['lymphatic', 'Lymphatic & immune']];
  const LAUNCH = [['home', 'Home'], ['last', 'Last screen used'], ['decks', 'Cards'], ['learn', 'Learn'], ['library', 'Library'], ['weak', 'Weak Spots'], ['doc', 'Doctordle'], ['anat', 'Anatomy'], ['stats', 'Stats']];
  const TTS = [['en', 'English', 'en-US', 'The hippocampus helps form new memories.']];
  const pct = v => Math.round(v * 100) + '%', xf = v => v.toFixed(2).replace(/0$/, '') + '×';
  const lbl = (list, v) => { const o = list.find(x => String(x[0]) === String(v)); return o ? o[1] : ''; };

  /* ---------- pages ---------- */
  const PAGES = {
    root: { t: 'Settings', b: () => `
      <div class="st-search"><span class="st-sic">${I('search', 17)}</span><input type="search" id="stQ" placeholder="Search" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Search settings"><button type="button" class="st-qx" data-s-qx hidden aria-label="Clear">${I('x', 14)}</button></div>
      <div id="stRes" hidden></div>
      <div id="stMain">
      ${window.Account && Account.on ? group('', act('acctOpen', Account.user() ? 'Account' : 'Sign in to sync', 'st-link st-acct', Account.user() ? E(Account.label()) : 'Optional: keep your progress and Pro on every device')) : ''}
      ${window.Pro && Pro.on ? group('', act('proOpen', 'Synapse Pro', 'st-link st-pro', Pro.label())) : ''}
      ${group('', nav('appearance', 'Appearance', 'palette', lbl([['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark'], ['amoled', 'Black']], G('theme'))) + nav('home', 'Home Screen', 'home') + nav('navigation', 'Navigation', 'nav'))}
      ${group('', nav('study', 'Study', 'book', G('study.goal') + ' XP goal') + nav('cards', 'Cards', 'cards') + nav('learn', 'Learn', 'learn') + nav('doc', 'Doctordle', 'doc') + nav('anat', 'Anatomy', 'anat') + nav('library', 'Library & Resources', 'library'))}
      ${group('', nav('notify', 'Notifications', 'bell') + nav('sound', 'Sounds & Haptics', 'speaker') + nav('a11y', 'Accessibility', 'access'))}
      ${group('', nav('data', 'Data & Sync', 'data') + nav('help', 'Help & feedback', 'help') + nav('about', 'About', 'info'))}
      <div class="pgroup st-g st-reset">${act('resetSettings', 'Reset all settings', 'danger')}</div>
      <p class="st-gf center">Settings sync to your other devices when you’re signed in or use a sync code. Your cards and progress are never touched by a settings reset.</p>
      </div>` },
    appearance: { t: 'Appearance', b: () => {
      const a = String(G('accent')).toLowerCase(), custom = !ACC().some(x => x[1] === a);
      return `<div class="st-preview" aria-hidden="true"><div class="st-pv-card"><div class="st-pv-k">Preview</div><div class="st-pv-t">The hippocampus</div><p>Forms new memories and helps you find your way. Damage here makes it hard to learn new facts.</p><span class="st-pv-btn">Continue</span></div></div>
      ${group('Theme', seg('theme', 'Theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark'], ['amoled', 'Black']]) + seg('ui.bg', 'Background', [['solid', 'Solid'], ['gradient', 'Gradient'], ['oled', 'OLED']], 'OLED makes the dark theme pure black.'))}
      ${group('Accent color', `<div class="prow col st-row"${reg('Accent color', '', 'accent')}><div class="st-acc">${ACC().map(([n, c]) => `<button type="button" class="acc-sw${a === c ? ' on' : ''}" style="--c:${c}" data-s-accent="${c}" aria-label="${n}"></button>`).join('')}<label class="acc-sw custom${custom ? ' on' : ''}" style="--c:${E(a)}" aria-label="Custom color"><input type="color" value="${E(a)}" data-s-color="accent"></label></div></div>`, 'The last circle picks any custom color.')}
      ${group('Text', sel('ui.font', 'App font', [['system', 'San Francisco'], ['rounded', 'Rounded'], ['serif', 'New York (serif)'], ['mono', 'Monospaced']]) + seg('text', 'Text size', [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']]) + tog('ui.bold', 'Bold text') + seg('ui.lineSpacing', 'Line spacing', [['compact', 'Compact'], ['normal', 'Normal'], ['relaxed', 'Relaxed']]) + sel('cards.font', 'Flashcard font', [['system', 'San Francisco'], ['rounded', 'Rounded'], ['serif', 'New York (serif)'], ['mono', 'Monospaced']]))}
      ${group('Shape & surfaces', seg('ui.corners', 'Corner style', [['square', 'Square'], ['rounded', 'Rounded'], ['round', 'Round']]) + tog('ui.blur', 'Blur & translucency', 'Frosted bars and sheets') + tog('ui.contrast', 'High contrast', 'Stronger lines and secondary text') + seg('ui.iconStyle', 'Icon weight', [['thin', 'Thin'], ['regular', 'Regular'], ['bold', 'Bold']]))}
      ${group('App icon', `<div class="prow col st-row"${reg('App icon', 'Classic, Mint, Ember, Mono', 'icon')}><div class="st-icons" role="radiogroup" aria-label="App icon">${[['default', 'Classic'], ['mint', 'Mint'], ['ember', 'Ember'], ['mono', 'Mono']].map(([k, n]) => `<button type="button" class="st-icon${G('icon') === k ? ' on' : ''}" role="radio" aria-checked="${G('icon') === k}" data-s-icon="${k}"><img src="icons/app-${k}.png" alt="" width="56" height="56"><span>${n}</span></button>`).join('')}</div></div>`, 'On iPhone the icon changes the next time you add the app to your Home Screen.')}`; } },
    home: { t: 'Home Screen', b: () => {
      const H = Prefs.v.home, N = {}; try { Home.TILES.forEach(t => { N[t.k] = t; }); } catch (e) {}
      const tiles = H.order.filter(k => N[k] && !N[k].tab && (!N[k].when || N[k].when())).map((k, i, arr) => { const hid = H.hidden.includes(k), t = N[k] || { name: k, ic: k }; return `<div class="prow st-row st-tile${hid ? ' off' : ''}"${reg(t.name + ' tile', 'Show, hide or move', '')}><span class="st-ic">${I(t.ic, 18)}</span><span class="st-nl">${E(t.name)}</span><span class="prow-c"><button type="button" class="st-mv" data-s-mv="${k}" data-d="-1" aria-label="Move ${E(t.name)} up"${i ? '' : ' disabled'}>${I('up', 16)}</button><button type="button" class="st-mv" data-s-mv="${k}" data-d="1" aria-label="Move ${E(t.name)} down"${i < arr.length - 1 ? '' : ' disabled'}>${I('down', 16)}</button><button type="button" class="sw${hid ? '' : ' on'}" role="switch" aria-checked="${!hid}" aria-label="Show ${E(t.name)}" data-s-tile="${k}"><i></i></button></span></div>`; }).join('');
      return `${group('Layout', seg('home.style', 'Shortcuts layout', [['grid', 'Grid'], ['list', 'List']]) + seg('ui.tileSize', 'Tile size', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']]) + seg('ui.density', 'Density', [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['spacious', 'Spacious']]))}
      ${group('Widgets', tog('home.greeting', 'Date & greeting') + tog('home.today', 'Today card', 'Streak, level, due and goal ring') + tog('home.plan', 'Plan', "Today's checklist") + tog('home.statsCard', 'Stats', 'This week’s XP') + tog('home.appsTitle', '“Shortcuts” heading'))}
      ${group('Today card shows', tog('home.stats.streak', 'Streak') + tog('home.stats.level', 'Level') + tog('home.stats.xp', 'XP bar') + tog('home.stats.goal', 'Daily goal ring'))}
      ${group('Shortcuts', tiles, 'Turn a tile off to hide it. Arrows change the order.')}
      ${group('On launch', sel('home.launch', 'Open the app to', LAUNCH))}`; } },
    navigation: { t: 'Navigation', b: () => `
      ${group('Gestures', tog('nav.swipeBack', 'Edge swipe goes back', 'Swipe right from the left edge to go back a screen') + seg('nav.swipeSens', 'Swipe sensitivity', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], 'High starts from further in and needs a shorter swipe.'))}
      ${group('Feedback', tog('nav.haptic', 'Haptic on navigation', 'A light tap when a swipe changes screens'))}` },
    study: { t: 'Study', b: () => `
      ${group('Goals', sel('study.goal', 'Daily XP goal', [10, 20, 30, 50, 75, 100, 150, 200, 250, 300, 500].map(n => [n, n + ' XP'])) + sel('study.session', 'Session length', [[0, 'No limit'], [10, '10 cards'], [20, '20 cards'], [30, '30 cards'], [50, '50 cards'], [100, '100 cards']], 'A nudge when you hit it'))}
      ${group('Focus timer', sel('focus.work', 'Focus length', [15, 20, 25, 30, 40, 45, 50, 60].map(n => [n, n + ' min'])) + sel('focus.brk', 'Break length', [3, 5, 10, 15].map(n => [n, n + ' min'])) + tog('focus.cards', 'Offer cards on the break', 'A quick review when a focus block ends'))}
      ${group('Daily limits', sel('cards.newPerDay', 'New cards per day', [0, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100].map(n => [n, String(n)])) + sel('study.reviewLimit', 'Review limit per day', [[50, '50'], [100, '100'], [200, '200'], [300, '300'], [500, '500'], [9999, 'No limit']]), 'Decks with their own limits keep them.')}
      ${group('Order', sel('study.order', 'Card order', [['due', 'Due first'], ['newfirst', 'New cards first'], ['random', 'Random'], ['newest', 'Newest new cards']]) + tog('study.intervals', 'Show next review times', 'The small times under Again / Hard / Good / Easy'))}
      ${group('Answers', seg('study.strict', 'Typed answers', [['lenient', 'Lenient'], ['normal', 'Normal'], ['exact', 'Exact']], 'Lenient forgives accents and one typo. Exact needs every letter.') + tog('study.hints', 'Hints', 'Near-miss hints and nudges') + tog('study.timer', 'Timer', 'Elapsed time while you study or test'))}
      ${group('Weak Spots', seg('weak.weight', 'Weighting', [['light', 'Light'], ['balanced', 'Balanced'], ['heavy', 'Heavy']], 'How often missed questions come back. Balanced is 1 · 3 · 7 days, heavy 1 · 2 · 4, light 2 · 5 · 12.'))}
      ${group('Audio', tog('study.autoplay', 'Auto-play audio', 'Plays a card’s audio when the answer shows') + tog('study.romanization', 'Show romanization', 'Readings above Japanese and Russian text') + nav('voices', 'Voices & speed', 'wave'))}` },
    voices: { t: 'Voices & speed', b: () => {
      const vs = Settings.voices();
      return TTS.map(([l, name, code]) => { const opts = [['', 'Automatic (best)']].concat(vs.filter(v => String(v.lang).replace('_', '-').toLowerCase().startsWith(l)).map(v => [v.name, v.name + (/enhanced|premium/i.test(v.name) ? '' : '')]));
        return group(name, sel('tts.' + l + '.voice', name + ' voice', opts) + range('tts.' + l + '.rate', name + ' speed', .5, 1.5, .05, xf) + act('say:' + l, 'Play a sample', 'st-link')); }).join('')
        + group('', tog('learn.slow', 'Slow listening in Learn', 'Halves the speed of lesson audio')) + `<p class="st-gf">Download better voices in iPhone Settings → Accessibility → Spoken Content → Voices.</p>`; } },
    cards: { t: 'Cards', b: () => `
      ${group('Study screen', seg('cards.flip', 'Flip animation', [['flip', 'Flip'], ['fade', 'Fade'], ['none', 'None']]) + tog('cards.swipe', 'Swipe to grade', 'Right = Good, left = Again, up = show answer'))}
      ${group('', nav('study', 'Limits, order and answers', 'book'))}` },
    learn: { t: 'Learn', b: () => `
      ${group('Lessons', sel('learn.level', 'Default level', LEVELS) + seg('learn.explain', 'Explanations', [['always', 'Always'], ['wrong', 'When wrong'], ['never', 'Never']]))}
      ${group('Tests', sel('learn.testLen', 'Test length', [[0, 'Full test'], [5, '5 questions'], [6, '6 questions'], [10, '10 questions']]))}
      ${group('Audio', tog('learn.slow', 'Slow listening'))}` },
    doc: { t: 'Doctordle', b: () => `
      ${group('Game', seg('doc.hard', 'Difficulty', [[false, 'Normal'], [true, 'Hard']], 'Hard: history and vitals are free, every other clue costs a guess.') + tog('doc.timed', 'Timed mode', 'Three minutes per case') + seg('doc.clueOrder', 'Clue order', [['classic', 'Classic'], ['labs', 'Labs first'], ['random', 'Random']]))}
      ${group('', tog('study.hints', 'Near-miss hints'))}` },
    anat: { t: 'Anatomy', b: () => {
      const L = G('anat.layers') || [];
      return `${group('Start with', seg('anat.sex', 'Body', [['m', 'Male'], ['f', 'Female']]) + SYSTEMS.map(([k, n]) => `<div class="prow st-row"${reg(n + ' layer', 'Default layers', '')}><span class="prow-l"><span>${E(n)}</span></span><button type="button" class="sw${L.includes(k) ? ' on' : ''}" role="switch" aria-checked="${L.includes(k)}" aria-label="${E(n)} on at start" data-s-layer="${k}"><i></i></button></div>`).join(''), 'Layers that are on when the explorer opens.')}
      ${group('Labels', tog('anat.labels', 'Show labels') + seg('anat.labelSize', 'Label size', [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']]))}
      ${group('Rendering', seg('anat.quality', 'Render quality', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], 'Ultra renders at full Retina resolution and uses more battery.') + tog('anat.shadows', 'Shadows') + tog('anat.autoRotate', 'Auto-rotate'))}
      ${group('Touch', range('anat.sensitivity', 'Rotate & zoom sensitivity', .5, 2, .1, xf) + seg('anat.isolate', 'When you isolate a part', [['ghost', 'Ghost others'], ['dim', 'Dim others'], ['hide', 'Hide others']]))}`; } },
    library: { t: 'Library & Resources', b: () => `
      ${group('Library', seg('lib.mode', 'Opens to', [['decks', 'Deck library'], ['resources', 'Resources']]) + sel('lib.sort', 'Sort decks by', [['popular', 'Most popular'], ['az', 'Name'], ['cards', 'Card count']]))}
      ${group('Resources', seg('res.openIn', 'Open links', [['app', 'In the app'], ['safari', 'In Safari']]))}` },
    notify: { t: 'Notifications', b: () => `
      <div id="stPush" class="st-push"></div>
      ${group('More', time('notify.second', 'Second reminder', 'Only if you still haven’t studied', true) + tog('notify.quiet', 'Quiet hours', 'No reminders in this window') + (G('notify.quiet') ? time('notify.quietFrom', 'From') + time('notify.quietTo', 'To') : '') + seg('notify.recapDay', 'Weekly recap', [['sun', 'Sunday'], ['mon', 'Monday']]))}
      ${group('Badge', tog('notify.badge', 'App icon badge', 'Cards due + weak spots on the Home Screen icon'), 'Needs notifications allowed for the app.')}` },
    sound: { t: 'Sounds & Haptics', b: () => `
      ${group('', tog('haptics', 'Haptics', 'Light taps on buttons and switches') + tog('sounds', 'Sounds', 'Soft tones for right, wrong and XP') + tog('nav.haptic', 'Haptic on navigation'))}
      ${group('', act('testSound', 'Play test sound', 'st-link'))}` },
    a11y: { t: 'Accessibility', b: () => `
      ${group('Vision', seg('text', 'Text size', [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']]) + tog('ui.bold', 'Bold text') + tog('ui.contrast', 'Increase contrast') + tog('a11y.underline', 'Underline links') + tog('a11y.dyslexia', 'Dyslexia-friendly spacing', 'Wider letter, word and line spacing'))}
      ${group('Motion', seg('reduceMotion', 'Reduce motion', [['auto', 'System'], [true, 'On'], [false, 'Off']]) + tog('a11y.reduceTransparency', 'Reduce transparency', 'Solid bars and sheets, no blur'))}
      ${group('Interaction', tog('a11y.bigTargets', 'Larger tap targets') + tog('a11y.captions', 'Captions', 'Shows the words while audio plays'))}` },
    data: { t: 'Data & Sync', b: () => {
      const has = typeof meta !== 'undefined' && (meta.code || meta.acct), last = typeof meta !== 'undefined' && meta.lastSync;
      return `${group('Sync', tog('data.sync', 'Sync', 'Keeps cards, progress and settings the same on every device') + info('Status', has ? (G('data.sync') ? 'On' : 'Paused') : 'Not set up', 'stSyncSt') + info('Last synced', last ? E(new Date(last).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) : '—', 'stSyncLast') + (has ? act('syncNow', 'Sync now', 'st-link') : '') + (window.Account && Account.on ? act('acctOpen', Account.user() ? 'Account' : 'Sign in to sync', 'st-link', Account.user() ? E(Account.label()) : 'Email and password, optional') : '') + (meta.acct ? '' : act('syncSetup', has ? 'Sync code' : 'Use a sync code instead', 'st-link')))}
      ${group('Backup', act('exportMine', 'Export my data', 'st-link', 'One JSON file with every card, review, progress and setting') + `<label class="prow act st-row st-act st-link"${reg('Import backup', 'Restore from a JSON file', '')}><span class="prow-l"><span>Import backup</span><small>Restore from a JSON file</small></span><input type="file" accept=".json,application/json" data-s-import hidden></label>`)}
      ${group('Storage', info('Used by the app', '…', 'stUse') + info('Cards', E(String(typeof M !== 'undefined' ? M.cards.size : 0)), '') + info('Settings & progress', '…', 'stLs') + act('clearCache', 'Clear app cache', 'st-link', 'Re-downloads the app shell and courses') + act('clearModels', 'Clear 3D models', 'st-link', 'Anatomy layers download again when used'))}
      ${group('Reset progress', act('reset:learn', 'Reset Learn progress', 'danger-l') + act('reset:doc', 'Reset Doctordle', 'danger-l') + act('reset:weak', 'Clear Weak Spots', 'danger-l') + act('reset:anat', 'Reset Anatomy progress', 'danger-l'), 'Each asks first. XP, streak and cards stay.')}
      ${group('Delete', act('deleteMine', 'Delete my data', 'danger-l', 'Erase everything on this device, and the synced copy if you want'), 'Asks twice. Export first if you might want it back.')}`; } },
    about: { t: 'About', b: () => `
      <div class="ab-hero"${reg('Made by Odin', '', '')}><img src="${E(document.querySelector('link[rel=apple-touch-icon]') ? document.querySelector('link[rel=apple-touch-icon]').getAttribute('href') : 'apple-touch-icon.png')}" alt="" width="84" height="84"><b>Synapse</b><span>Made by Odin</span></div>
      ${group('', info('Version', '…', 'stVer') + info('Developer', 'Northpeak Studios', '') + info('Courses', '200', '') + (window.OdinUpdate ? act('appUpdate', 'Check for updates', 'st-link', E(OdinUpdate.label())) + act('appUpdateReset', 'Use the built-in version', 'st-link', 'Undo downloaded updates if something looks wrong') : '') + nav('whatsnew', "What's new") + nav('credits', 'Credits & licenses') + nav('help', 'Help & feedback'))}
      ${group('', `<div class="prow st-row ab-disc"${reg('Not medical advice', 'For learning only', '')}>${I('shield', 18)}<span>For learning only, not medical advice. Don’t use anything in this app to diagnose or treat yourself or anyone else. Ask a doctor or pharmacist about real health questions.</span></div>` + `<a class="prow act st-row st-act st-link" href="https://odin-cards.sites.tab.bot/privacy/" target="_blank" rel="noopener"${reg('Privacy policy', '', '')}><span class="prow-l"><span>Privacy policy</span></span></a>` + `<a class="prow act st-row st-act st-link" href="mailto:northpeak.support@gmail.com?subject=Synapse"${reg('Support email', 'northpeak.support@gmail.com', '')}><span class="prow-l"><span>Email support</span><small>northpeak.support@gmail.com</small></span></a>`)}` },
    help: { t: 'Help & feedback', b: () => `
      ${group('Questions', FAQ.map(([q, a]) => `<details class="prow col st-row ab-faq"${reg(q, '', '')}><summary>${E(q)}</summary><p>${a}</p></details>`).join(''))}
      ${group('Send feedback', `<form class="prow col st-row ab-fb" id="abFb"${reg('Send feedback', 'Bug, idea or anything else', '')} novalidate><div class="ab-types" role="radiogroup" aria-label="Feedback type"><label><input type="radio" name="fbtype" value="bug" checked><span>Bug</span></label><label><input type="radio" name="fbtype" value="idea"><span>Idea</span></label><label><input type="radio" name="fbtype" value="other"><span>Other</span></label></div><textarea maxlength="2000" placeholder="What happened, or what would make the app better?" aria-label="Feedback message"></textarea><div class="ab-fbrow"><span class="ab-count">0 / 2000</span><button type="submit" class="ab-send">Send feedback</button></div><span class="ab-ok">Sent. Thank you!</span></form>`, 'No name or email needed. Please don’t include personal info.')}
      ${group('', `<a class="prow act st-row st-act st-link" href="mailto:northpeak.support@gmail.com?subject=Synapse"${reg('Support email', 'northpeak.support@gmail.com', '')}><span class="prow-l"><span>Email support</span><small>northpeak.support@gmail.com</small></span></a>` + act('tour', 'Replay the intro', 'st-link', 'The three welcome screens'))}` },
    whatsnew: { t: "What's new", b: () => `${group('', NEWS.map(([t, d]) => `<div class="prow col st-row st-news"${reg(t, '', '')}><b>${E(t)}</b><span>${E(d)}</span></div>`).join(''))}` },
    credits: { t: 'Credits & licenses', b: () => `<p class="st-gf ab-note"${reg('Credits & licenses', 'Sounds, images, decks, libraries', '')}>Everything here that wasn’t made for this app, with its author and licence. Lessons, cards, cases and descriptions are written for this app.</p><div id="abCred"><p class="st-gf">Loading…</p></div>` }
  };
  const NEWS = [['Settings, rebuilt', 'Search, more than 90 options, sub-pages, and appearance changes that apply right away.'], ['3D Anatomy', 'A full body explorer with 10 systems, isolate, lessons and tests.'], ['Stats & badges', 'XP chart, heatmap, weekly recap, about 30 badges and a focus timer.'], ['Streak reminders', 'A push reminder on days you haven’t studied yet.'], ['Doctordle', '64 cases with history, vitals, exam, labs and imaging clues.'], ['Learn', '200 courses across Medicine, Med Chem, Pharmacology and Neurology.']];
  const FAQ = [['Do I need an account?', 'An account is optional. Signing in syncs your decks, progress and settings to every device you sign in on, and keeps Synapse Pro on your account. Settings → Account to sign in, log out, change your password or delete the account. Forgot your password? Contact northpeak.support@gmail.com.'], ['What is a sync code?', 'A private code that links your devices. Turn on sync in More → Sync &amp; backup, then enter the same code on your other phone or computer. Anyone with the code can see your cards, so keep it to yourself.'], ['How do I back up?', 'Settings → Data &amp; Sync → Export my data saves one file with every card, review and setting. Import backup puts it back.'], ['Does it work offline?', 'Yes. Cards, courses you’ve opened and most Lab tools work with no signal. Sync, feedback, the Deck Library and look-ups need a connection.'], ['I deleted the Home Screen app. Where did my cards go?', 'Deleting the app also deletes its data on that phone. If sync was on, enter your sync code again and everything comes back. Without sync or a backup file, it can’t be recovered.'], ['Is this medical advice?', 'No. Everything here is for learning. Ask a doctor or pharmacist about real health questions.'], ['How do I delete my data?', 'Settings → Data &amp; Sync → Delete my data. It can also delete the synced copy on the server.']];
  const CREDITS = [['BodyParts3D', '© The Database Center for Life Science (DBCLS), CC BY-SA 2.1 Japan. Anatomy models.'], ['three.js', 'MIT License. 3D rendering.'], ['meshoptimizer', 'MIT License. Model compression.'], ['sql.js', 'MIT License. Reads Anki decks.'], ['JSZip', 'MIT License. Opens deck packages.'], ['fzstd', 'MIT License. Decompression.'], ['QR code generator', 'MIT License. Sync codes.'], ['Icons', 'Drawn for this app, plus shapes in the style of Lucide (ISC).']];

  /* ---------- stack + rendering ---------- */
  let stack = ['root'], root = null, scrolls = {};
  function count() { IDX = []; for (const id in PAGES) { CUR = id; try { PAGES[id].b(); } catch (e) {} } const n = IDX.filter(x => x.key).length; IDX = null; return n; }
  function index() { IDX = []; for (const id in PAGES) { if (id === 'root') continue; CUR = id; try { PAGES[id].b(); } catch (e) {} } const out = IDX; IDX = null; return out; }
  function pageHTML(id) {
    const p = PAGES[id], back = stack.length > 1 ? PAGES[stack[stack.length - 2]].t : '';
    return `<div class="st-nb${id === 'root' ? ' root' : ''}"><div class="st-nbi">${id === 'root' && window.Shell && Shell.canBack() ? `<button type="button" class="st-back" data-s-home aria-label="Back to ${E(Shell.backLabel())}">${I('back', 20)}<span>${E(Shell.backLabel())}</span></button>` : id === 'root' ? `<button type="button" class="st-back" data-s-home aria-label="Home"><span class="st-house"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h4.5v-6h4v6h4.5V9.5"/></svg></span></button>` : `<button type="button" class="st-back" data-s-back aria-label="Back to ${E(back)}">${I('back', 20)}<span>${E(back)}</span></button>`}<div class="st-nt">${E(p.t)}</div></div></div>
      ${id === 'root' ? '<h1 class="st-lt">Settings</h1>' : ''}<div class="st-body">${p.b()}</div>`;
  }
  function el() { return document.getElementById('v-prefs'); }
  function render(target) {
    const host = target || el(); if (!host) return;
    if (!host.querySelector('.st')) { host.innerHTML = '<div class="st" id="st"><section class="st-pg"></section></div>'; }
    root = host.querySelector('.st');
    paint(false);
  }
  function paint(anim) {
    const id = stack[stack.length - 1], pg = root.querySelector('.st-pg');
    const q = id === 'root' && document.getElementById('stQ') ? document.getElementById('stQ').value : '';
    pg.dataset.pg = id; pg.innerHTML = pageHTML(id);
    if (anim) { pg.classList.remove('st-in', 'st-out-back'); void pg.offsetWidth; pg.classList.add(anim); }
    after(id);
    if (q) { const i = document.getElementById('stQ'); i.value = q; search(q); }
  }
  function fitBack() { const s = root && root.querySelector('.st-back span'); if (!s) return; if (s.scrollWidth > s.clientWidth + 1) { s.textContent = 'Back'; if (s.scrollWidth > s.clientWidth + 1) s.textContent = ''; } }
  function after(id) {
    fitBack();
    if (id === 'notify') { const h = document.getElementById('stPush'); try { if (window.Push && h) Push.render(h); else if (h) h.innerHTML = '<div class="prow"><span class="prow-l"><span>Reminders</span><small>Not available on this device</small></span></div>'; } catch (e) {} }
    if (id === 'data') storage();
    if (id === 'about') version();
    if (window.About && About.after) try { About.after(id, root); } catch (e) {}
    if (id === 'voices' && !Settings.voices().length) try { speechSynthesis.addEventListener('voiceschanged', () => { if (stack[stack.length - 1] === 'voices') paint(false); }, { once: true }); } catch (e) {}
  }
  function push(id) { if (!PAGES[id]) return; scrolls[stack[stack.length - 1]] = window.scrollY; stack.push(id); paint('st-in'); window.scrollTo(0, 0); }
  function pop() { if (stack.length < 2) { if (window.Shell && Shell.canBack()) Shell.back(); else go('home'); return; } stack.pop(); const id = stack[stack.length - 1]; paint('st-back-in'); window.scrollTo(0, scrolls[id] || 0); }
  function open(id) { stack = ['root']; if (id && id !== 'root') stack.push(id); if (typeof view === 'undefined' || view !== 'prefs') go('prefs'); else render(); window.scrollTo(0, 0); }

  /* ---------- search ---------- */
  let IX = null;
  function search(q) {
    const res = document.getElementById('stRes'), main = document.getElementById('stMain'), qx = root.querySelector('[data-s-qx]'); if (!res) return;
    q = q.trim().toLowerCase(); qx.hidden = !q;
    if (!q) { res.hidden = true; main.hidden = false; return; }
    IX = IX || index();
    const words = q.split(/\s+/), hits = IX.filter(x => { const h = (x.label + ' ' + x.sub + ' ' + PAGES[x.page].t).toLowerCase(); return words.every(w => h.includes(w)); });
    const seen = new Set(), list = hits.filter(x => { const k = x.page + '|' + x.label; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 40);
    main.hidden = true; res.hidden = false;
    res.innerHTML = list.length ? `<div class="pgroup st-g">${list.map(x => `<button type="button" class="prow act st-row st-hit" data-s-jump="${x.page}" data-l="${E(x.label)}"><span class="prow-l"><span>${E(x.label)}</span><small>${E(PAGES[x.page].t)}</small></span>${I('chev', 14)}</button>`).join('')}</div>` : `<p class="st-empty">No results for “${E(q)}”</p>`;
  }
  function jump(page, label) {
    push(page);
    setTimeout(() => { const r = [...root.querySelectorAll('[data-lbl]')].find(x => x.dataset.lbl === label); if (r) { r.scrollIntoView({ block: 'center' }); r.classList.add('st-flash'); setTimeout(() => r.classList.remove('st-flash'), 1400); } }, 60);
  }

  /* ---------- data actions ---------- */
  const fmtB = b => b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';
  function storage() {
    try { navigator.storage.estimate().then(e => { const n = document.getElementById('stUse'); if (n) n.textContent = fmtB(e.usage || 0); }).catch(() => {}); } catch (e) { const n = document.getElementById('stUse'); if (n) n.textContent = '—'; }
    try { let b = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); b += (k.length + (localStorage.getItem(k) || '').length) * 2; } const n = document.getElementById('stLs'); if (n) n.textContent = fmtB(b); } catch (e) {}
  }
  let VER = '';
  function version() {
    const put = () => { const n = document.getElementById('stVer'); if (n) n.textContent = VER || '—'; };
    if (VER) return put();
    fetch('sw.js', { cache: 'no-store' }).then(r => r.text()).then(t => { const m = t.match(/CACHE\s*=\s*['"]([^'"]+)['"]/); VER = m ? m[1].replace(/^cards-v/, 'Version ') : 'Unknown'; put(); }).catch(() => { VER = 'Offline'; put(); });
  }
  async function delKinds(kinds, label) {
    if (!confirm(label + '? This can’t be undone.')) return false;
    const list = []; for (const r of M.progress.values()) if (!r.del && kinds.includes(r.t)) list.push(['progress', { ...r, del: 1 }]);
    for (let i = 0; i < list.length; i += 2000) await write(list.slice(i, i + 2000));
    return list.length;
  }
  async function resetApp(app) {
    try {
      if (app === 'learn') { const n = await delKinds(['lesson'], 'Reset all Learn progress'); if (n === false) return; try { localStorage.removeItem('lrn.last'); } catch (e) {} toast('Learn progress reset'); }
      else if (app === 'doc') { const n = await delKinds(['doc', 'docday'], 'Reset Doctordle history'); if (n === false) return; Object.keys(localStorage).filter(k => /^doc/.test(k)).forEach(k => localStorage.removeItem(k)); toast('Doctordle reset'); }
      else if (app === 'weak') { const n = await delKinds(['ws'], 'Clear every Weak Spot'); if (n === false) return; toast('Weak Spots cleared'); }
      else if (app === 'anat') { if (!confirm('Reset Anatomy progress? This can’t be undone.')) return; localStorage.removeItem('anat.v1'); toast('Anatomy progress reset'); }
    } catch (e) { toast('Couldn’t reset: ' + e.message); }
  }
  async function importBackup(f) {
    try {
      const j = JSON.parse(await f.text());
      const data = j && j.app === 'odin-cards' ? j.data : j && j.app === 'cards' ? j : null; if (!data) throw new Error('not a backup from this app');
      const list = [];
      for (const s of ['decks', 'notes', 'cards', 'revlog', 'progress']) for (const o of data[s] || []) { if (!o || !o.id) continue; const ex = M[s].get(o.id); if (!ex || (o.mod || 0) > (ex.mod || 0)) list.push([s, o]); }
      const loc = j.local ? Object.keys(j.local) : [];
      if (!confirm(`Restore ${list.length} item${list.length === 1 ? '' : 's'}${loc.length ? ' and ' + loc.length + ' saved settings' : ''} from ${f.name}? Newer data on this device is kept.`)) return;
      for (let i = 0; i < list.length; i += 2000) await write(list.slice(i, i + 2000), { keepMod: true });
      loc.forEach(k => { if (/^(hub|prefs|ol\.|doc|res|lrn|learn|weak|chess|anat|settings)/.test(k)) try { localStorage.setItem(k, j.local[k]); } catch (e) {} });
      toast('Restored. Reloading…', 1800); setTimeout(() => location.reload(), 1200);
    } catch (e) { toast('Import failed: ' + e.message, 3000); }
  }
  async function clearCache(models) {
    if (!confirm(models ? 'Remove downloaded 3D models? They download again when you open a layer.' : 'Clear the app cache? The app reloads and downloads itself again.')) return;
    try { const ks = await caches.keys(); await Promise.all(ks.filter(k => models ? k.startsWith('anat-models') : (k.startsWith('cards-'))).map(k => caches.delete(k))); } catch (e) {}
    if (models) { toast('3D models cleared'); storage(); } else { toast('Cache cleared. Reloading…'); setTimeout(() => location.reload(), 900); }
  }
  function say(l) { const t = TTS.find(x => x[0] === l); if (!t || !('speechSynthesis' in window)) { toast('Listening isn’t supported here'); return; } speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t[3]); u.lang = t[2]; speechSynthesis.speak(u); }

  /* ---------- events ---------- */
  const inSt = e => e.target.closest && e.target.closest('#st');
  const parse = s => { try { return JSON.parse(s); } catch (e) { return s; } };
  document.addEventListener('click', e => {
    if (!inSt(e)) return; const t = e.target.closest('button,[data-s-act]'); if (!t) return; const d = t.dataset;
    if (d.sTog) { SET(d.sTog, !G(d.sTog)); if (d.sTog === 'notify.quiet' || d.sTog === 'data.sync') paint(false); else { t.classList.toggle('on', !!G(d.sTog)); t.setAttribute('aria-checked', String(!!G(d.sTog))); } return; }
    if (d.sSeg) { SET(d.sSeg, parse(d.v)); t.parentNode.querySelectorAll('button').forEach(b => { const on = b === t; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); return; }
    if (d.sIcon) { SET('icon', d.sIcon); paint(false); return; }
    if (d.sAccent) { SET('accent', d.sAccent); paint(false); return; }
    if (d.sNav) { push(d.sNav); return; }
    if (d.sBack != null) { pop(); return; }
    if (d.sHome != null) { if (window.Shell && Shell.canBack()) Shell.back(); else go('home'); return; }
    if (d.sJump) { jump(d.sJump, d.l); return; }
    if (d.sQx != null) { const i = document.getElementById('stQ'); i.value = ''; search(''); i.focus(); return; }
    if (d.sClear) { SET(d.sClear, ''); paint(false); return; }
    if (d.sLayer) { const L = (G('anat.layers') || []).slice(), i = L.indexOf(d.sLayer); if (i >= 0) L.splice(i, 1); else L.push(d.sLayer); SET('anat.layers', L); t.classList.toggle('on', i < 0); t.setAttribute('aria-checked', String(i < 0)); return; }
    if (d.sTile) { const H = Prefs.v.home.hidden.slice(), i = H.indexOf(d.sTile); if (i >= 0) H.splice(i, 1); else H.push(d.sTile); SET('home.hidden', H); paint(false); return; }
    if (d.sMv) { const o = Prefs.v.home.order.slice(), i = o.indexOf(d.sMv), j = i + (+d.d); if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; SET('home.order', o); const y = window.scrollY; paint(false); window.scrollTo(0, y); return; }
    const a = d.sAct; if (!a) return;
    if (a === 'resetSettings') { if (confirm('Reset every setting to its default? Your cards and progress stay.')) { Settings.reset(); toast('Settings reset'); paint(false); } }
    else if (a === 'syncNow') { try { syncNow(true).then(() => paint(false)); } catch (x) {} }
    else if (a === 'syncSetup') go('settings');
    else if (a === 'exportMine') { if (window.About) About.exportAll(); }
    else if (a === 'deleteMine') { if (window.About) About.deleteAll(); }
    else if (a === 'proOpen') { if (window.Pro) Pro.paywall(); }
    else if (a === 'acctOpen') { if (window.Account) Account.open(); }
    else if (a === 'appUpdate') { if (window.OdinUpdate) OdinUpdate.check(true).then(() => paint(false)); }
    else if (a === 'appUpdateReset') { if (window.OdinUpdate && confirm('Go back to the version built into the app? Your cards stay.')) OdinUpdate.reset(); }
    else if (a === 'tour') { if (window.About) About.tour(true); }
    else if (a === 'export') { try { PrefsUI.exportAll(); } catch (x) { toast('Export failed'); } }
    else if (a === 'clearCache') clearCache(false);
    else if (a === 'clearModels') clearCache(true);
    else if (a.startsWith('reset:')) resetApp(a.slice(6));
    else if (a.startsWith('say:')) say(a.slice(4));
    else if (a === 'testSound') { const was = Prefs.v.sounds; if (!was) toast('Sounds are off'); Prefs.sound('xp'); Prefs.haptic(); }
  });
  document.addEventListener('change', e => {
    if (!inSt(e)) return; const t = e.target, d = t.dataset;
    if (d.sSel) { SET(d.sSel, parse(t.value)); const v = t.closest('.st-sel').querySelector('.st-val'); if (v) v.textContent = t.options[t.selectedIndex].text; }
    else if (d.sTime) { SET(d.sTime, t.value); if (d.sTime === 'notify.second') paint(false); }
    else if (d.sColor) SET('accent', t.value);
    else if (d.sImport != null) { const f = t.files[0]; t.value = ''; if (f) importBackup(f); }
    else if (d.sRange) SET(d.sRange, +t.value);
  });
  document.addEventListener('input', e => {
    if (!inSt(e)) return; const t = e.target;
    if (t.id === 'stQ') search(t.value);
    else if (t.dataset.sRange) { const k = t.dataset.sRange, o = root.querySelector(`[data-rv="${k}"]`); if (o) o.textContent = /rate|sensitivity/.test(k) ? xf(+t.value) : 'depth ' + t.value; }
    else if (t.dataset.sColor) { const l = t.closest('.acc-sw'); if (l) l.style.setProperty('--c', t.value); document.documentElement.style.setProperty('--acc', t.value); }
  });
  // edge swipe inside settings goes back one page (not home)
  let sx = null;
  document.addEventListener('touchstart', e => { if (!inSt(e) || stack.length < 2 || e.touches[0].clientX > 24) { sx = null; return; } sx = { x: e.touches[0].clientX, y: e.touches[0].clientY }; e.stopPropagation(); }, { passive: true });
  document.addEventListener('touchend', e => { if (!sx) return; const t = e.changedTouches[0]; if (t.clientX - sx.x > 80 && Math.abs(t.clientY - sx.y) < 60) pop(); sx = null; });
  // remote / other-module changes repaint the open page
  let rT = 0;
  Settings.on('*', (v, o, k, remote) => { if (!remote || typeof view === 'undefined' || view !== 'prefs' || !root) return; clearTimeout(rT); rT = setTimeout(() => { const y = window.scrollY; paint(false); window.scrollTo(0, y); }, 200); });

  window.addEventListener('account:change', () => { if (typeof view === 'undefined' || view !== 'prefs' || !root) return; const y = window.scrollY; paint(false); window.scrollTo(0, y); });
  window.SettingsUI = { render, open, push, count, index: () => index() };
})();
