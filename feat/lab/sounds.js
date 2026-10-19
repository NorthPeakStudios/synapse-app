/* Heart sounds + lung sounds trainers. REAL recordings only (Wikimedia Commons, open licences), credit line on every sound. Learn list + quiz. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2();
  let D = null, au = null, playing = null;
  const ST = {};
  const KIND = { heart: { t: 'Heart sounds', b: 'Real stethoscope recordings: normal rhythms, extra beats, innocent and disease murmurs. Use headphones.', none: 'No openly licensed real recordings of aortic stenosis, mitral regurgitation alone, S3 or S4 could be verified, so they\'re not here yet.' },
    lung: { t: 'Lung sounds', b: 'Real recordings of wheeze, crackles, stridor and whooping cough. Use headphones.', none: 'Openly licensed real recordings of normal vesicular breathing, rhonchi and pleural rub couldn\'t be found, so they\'re not here yet.' } };
  const playIc = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>', stopIc = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>';
  function stop() { try { if (au) { au.pause(); au.currentTime = 0; } } catch (e) {} playing = null; try { window.TTSAudio && TTSAudio.release(); } catch (e) {} document.querySelectorAll('[data-sd-play].on').forEach(b => { b.classList.remove('on'); b.innerHTML = playIc; }); }
  function play(id, btn) {
    const s = D.sounds.find(x => x.id === id); if (!s) return;
    if (playing === id) { stop(); return; }
    stop();
    try { window.TTSAudio && TTSAudio.hold(); } catch (e) {}
    if (!au) { au = new Audio(); au.setAttribute('playsinline', ''); au.preload = 'auto'; au.addEventListener('ended', stop); au.addEventListener('timeupdate', () => { if (!document.querySelector('.lb.sd')) stop(); }); au.addEventListener('error', () => { stop(); try { toast('Couldn\'t play that sound. Check your connection.'); } catch (e) {} }); }
    au.src = s.file + '?v=' + L.VER; playing = id;
    const p = au.play(); if (p && p.catch) p.catch(() => stop());
    if (btn) { btn.classList.add('on'); btn.innerHTML = stopIc; }
  }
  const credit = s => `<p class="sd-cred">Audio: ${esc(s.artist)}, ${esc(s.lic)}, via <a href="${esc(s.url)}" target="_blank" rel="noopener">Wikimedia Commons</a> (trimmed, converted)</p>`;
  function mk(kind) {
    return { render(el) {
      const S = ST[kind] = { el, mode: 'menu' };
      if (!el.__sd) { el.__sd = 1; el.addEventListener('click', e => onClick(kind, e)); }
      el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
      L.json('feat/lab/media.json').then(d => { D = d; if (ST[kind] === S) paint(kind); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
    }, _S: () => ST[kind] };
  }
  function list(kind) { return D.sounds.filter(s => s.k === kind); }
  function paint(kind) {
    const S = ST[kind]; if (!S || !S.el.isConnected) return; stop(); let h = ''; const K = KIND[kind], all = list(kind);
    if (S.mode === 'menu') {
      const st = L.stat(kind);
      h = L.top(K.t, st ? `avg ${st.avg}%` : '', 'lab') + `<p class="muted lb-p">${K.b} ${all.length} recordings.</p>
        <button class="btn pri lb-wide" data-sd-quiz type="button">Quiz me</button>
        <div class="lb-group">${all.map(s => `<div class="sd-row"><button type="button" class="sd-play" data-sd-play="${s.id}" aria-label="Play ${esc(s.name)}">${playIc}</button><div class="sd-t"><b>${esc(s.name)}</b><p>${esc(s.desc)}</p>${credit(s)}</div></div>`).join('')}</div>
        <p class="lb-foot">Only real recordings. ${esc(K.none)} Not medical advice.</p>`;
    } else if (S.mode === 'end') {
      h = `${L.top('', '', 'lab')}<div class="lb-card sim-res"><div class="lz-big">${S.score}%</div><div class="sim-verd ${S.score >= 70 ? 'ok' : 'bad'}">${S.right}/${S.q.length} right</div></div>
        <div class="lb-btns"><button class="btn" data-sd-menu type="button">Back to the list</button><button class="btn pri" data-sd-quiz type="button">Again</button></div>`;
    } else {
      const s = S.q[S.i], done = S.pick != null;
      h = `<div class="lb-top"><button class="lb-back" type="button" data-sd-menu>${ic('back', 18)}<span>${K.t}</span></button><span class="lb-tr">${S.i + 1}/${S.q.length} · ${S.right} right</span></div>
        <div class="sd-big"><button type="button" class="sd-play big" data-sd-play="${s.id}" aria-label="Play the sound">${playIc}</button><p class="muted small">Tap to listen (as often as you like)</p></div>
        <p class="mt-h">What do you hear?</p>
        <div class="sim-opts">${S.opts.map(o => { const x = D.sounds.find(y => y.id === o); return `<button type="button" class="sim-o${done ? (o === s.id ? ' good' : o === S.pick ? ' badc' : '') : ''}" data-sd-o="${o}" ${done ? 'disabled' : ''}><span class="sim-q">${esc(x.name)}</span></button>`; }).join('')}</div>
        ${done ? `<div class="lb-card sim-sec"><h3>${S.pick === s.id ? 'Right' : 'It was: ' + esc(s.name)}</h3><p>${esc(s.desc)}</p>${credit(s)}</div><div class="lb-btns sticky"><button class="btn pri" data-sd-next type="button">${S.i + 1 < S.q.length ? 'Next' : 'Finish'}</button></div>` : ''}`;
    }
    S.el.innerHTML = `<div class="lb sd">${h}</div>`;
  }
  function quiz(kind) { const S = ST[kind], all = list(kind); S.q = L.shuffle(all).slice(0, Math.min(8, all.length)); S.i = 0; S.right = 0; S.mode = 'play'; setQ(kind); }
  function setQ(kind) {
    const S = ST[kind], s = S.q[S.i], all = list(kind);
    S.pick = null; S.opts = L.shuffle([s.id].concat(L.shuffle(all.filter(x => x.id !== s.id)).slice(0, 3).map(x => x.id))); paint(kind); window.scrollTo(0, 0);
  }
  function onClick(kind, e) {
    const S = ST[kind]; if (!S || !D) return; const t = e.target;
    const p = t.closest('[data-sd-play]'); if (p) { play(p.dataset.sdPlay, p); return; }
    if (t.closest('[data-sd-menu]')) { S.mode = 'menu'; paint(kind); window.scrollTo(0, 0); return; }
    if (t.closest('[data-sd-quiz]')) { quiz(kind); return; }
    const o = t.closest('[data-sd-o]'); if (o && S.mode === 'play' && S.pick == null) {
      const s = S.q[S.i]; S.pick = o.dataset.sdO; const ok = S.pick === s.id; if (ok) S.right++; L.fx(ok);
      L.mastery({ id: 'SD:' + s.id, tags: [kind === 'heart' ? 'cardiology' : 'respiratory', 'auscultation'], ok, choices: 4, label: (kind === 'heart' ? 'Heart sound: ' : 'Lung sound: ') + s.name, src: kind });
      const y = window.scrollY; paint(kind); window.scrollTo(0, y); return;
    }
    if (t.closest('[data-sd-next]')) {
      if (S.i + 1 >= S.q.length) { S.score = Math.round(100 * S.right / S.q.length); S.mode = 'end'; L.result(kind, 'quiz-' + new Date().toISOString().slice(0, 10), S.score); L.award(kind, 2 * S.right); paint(kind); window.scrollTo(0, 0); return; }
      S.i++; setQ(kind); return;
    }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('hashchange', stop);
  window.LabMods.heart = mk('heart'); window.LabMods.lung = mk('lung');
  window.LabMods.sounds = { stop, _au: () => au, _playing: () => playing };
})();
