/* Focus timer (pomodoro): 25/5 by default, survives app switches (timestamps in localStorage), XP per finished focus block. */
'use strict';
(function () {
  const KEY = 'focus.v1', I = (n, s) => Prefs.icon(n, s);
  const DEF = { work: 25, brk: 5, phase: 'work', endAt: 0, left: 25 * 60000, running: false, done: 0, day: '' };
  let F = (() => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { ...DEF }; } })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(F)); } catch (e) {} };
  const today = () => (window.Hub ? Hub.dayKey() : new Date().toDateString());
  if (F.day !== today()) { F.done = 0; F.day = today(); save(); }
  const SG = k => { try { return window.Settings ? Settings.get(k) : undefined; } catch (e) { return undefined; } };
  function fromSettings() { const w = +SG('focus.work'), b = +SG('focus.brk'); if (w > 0 && b > 0 && (w !== F.work || b !== F.brk)) { F.work = w; F.brk = b; if (!F.running) F.left = len(F.phase); save(); } }
  const len = p => (p === 'work' ? F.work : F.brk) * 60000;
  const remaining = () => F.running ? Math.max(0, F.endAt - Date.now()) : F.left;
  let timer = 0, el = null;
  function start() { F.endAt = Date.now() + remaining(); F.running = true; save(); loop(); Prefs.haptic(); }
  function pause() { F.left = remaining(); F.running = false; save(); paint(); }
  function reset(p) { F.phase = p || 'work'; F.running = false; F.left = len(F.phase); save(); paint(); }
  function complete() {
    const was = F.phase; F.running = false;
    if (was === 'work') { F.done++; try { Hub.award('focus', 10 + Math.round(F.work / 5)); } catch (e) {} }
    Prefs.sound('xp'); Prefs.haptic();
    F.phase = was === 'work' ? 'brk' : 'work'; F.left = len(F.phase); save(); paint();
    if (typeof toast === 'function') toast(was === 'work' ? 'Focus block done. Take ' + F.brk + ' min.' : 'Break over. Ready when you are.');
  }
  function loop() { clearInterval(timer); timer = setInterval(() => { if (F.running && remaining() <= 0) { clearInterval(timer); complete(); } else paint(); }, 250); paint(); }
  const fmt = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function paint() {
    if (!el || !document.body.contains(el)) return;
    const r = remaining(), tot = len(F.phase), pct = 1 - r / tot, R = 120, C = 2 * Math.PI * R;
    el.querySelector('.fo-time').textContent = fmt(r);
    el.querySelector('.fo-ph').textContent = F.phase === 'work' ? 'Focus' : 'Break';
    el.querySelector('.fo-arc').setAttribute('stroke-dashoffset', (C * (1 - pct)).toFixed(1));
    el.querySelector('[data-fo-go]').textContent = F.running ? 'Pause' : r < tot ? 'Resume' : 'Start';
    el.querySelector('.fo-done').textContent = F.done ? F.done + ' block' + (F.done === 1 ? '' : 's') + ' today' : 'No blocks yet today';
    el.classList.toggle('brk', F.phase !== 'work');
    const fb = el.querySelector('.fo-brk'); if (fb) fb.hidden = !(F.phase !== 'work' && SG('focus.cards') !== false);
  }
  function render(host) {
    fromSettings();
    const R = 120, C = 2 * Math.PI * R;
    host.innerHTML = `<div class="fo">
      <div class="fo-ring"><svg viewBox="0 0 272 272" width="272" height="272" aria-hidden="true"><circle cx="136" cy="136" r="${R}" fill="none" stroke="var(--fill2)" stroke-width="10"/><circle class="fo-arc" cx="136" cy="136" r="${R}" fill="none" stroke="var(--acc)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" transform="rotate(-90 136 136)"/></svg>
        <div class="fo-c"><div class="fo-ph">Focus</div><div class="fo-time">25:00</div><div class="fo-done"></div></div></div>
      <div class="fo-btns"><button class="btn" data-fo-reset type="button">Reset</button><button class="btn pri" data-fo-go type="button">Start</button></div>
      <div class="fo-brk" hidden><p>Break time. Want a quick review while you rest?</p><button class="btn pri" data-fo-cards type="button">Quick card review</button></div>
      <h3>Length</h3><div class="pseg">${[[15, 3], [25, 5], [50, 10]].map(([w, b]) => `<button type="button" class="${F.work === w ? 'on' : ''}" data-fo-len="${w}|${b}">${w} / ${b}</button>`).join('')}</div>
      <p class="pfoot">Each finished focus block gives XP and counts for your streak. Keep this screen open: iOS pauses web apps in the background, but the clock catches up when you come back.</p></div>`;
    el = host.querySelector('.fo'); paint(); if (F.running) loop();
  }
  document.addEventListener('click', e => {
    if (!el || !el.contains(e.target)) return;
    if (e.target.closest('[data-fo-go]')) { F.running ? pause() : start(); }
    else if (e.target.closest('[data-fo-reset]')) reset('work');
    else { if (e.target.closest('[data-fo-cards]')) { try { if (window.Settings && !(+Settings.get('study.session'))) {} studyDeck = '*'; undoStack = []; go('study'); } catch (x) { console.warn(x); } return; } const b = e.target.closest('[data-fo-len]'); if (b) { const [w, br] = b.dataset.foLen.split('|').map(Number); F.work = w; F.brk = br; try { if (window.Settings) { Settings.set('focus.work', w); Settings.set('focus.brk', br); } } catch (x) {} reset(F.phase); render(el.parentElement); } }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && F.running) { if (remaining() <= 0) complete(); else loop(); } });
  try { if (window.Settings) Settings.on('focus.*', () => { fromSettings(); if (el && document.body.contains(el)) paint(); }); } catch (e) {}
  window.Focus = { render, state: () => ({ ...F, remaining: remaining() }) };
})();
