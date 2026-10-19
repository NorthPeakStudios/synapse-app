/* Hands-free review: reads each due card aloud, listens for the spoken answer (speech recognition), grades it with a fuzzy match,
   reads the answer back, schedules the card exactly like a normal review, then moves on. Big buttons work as a fallback the whole time.
   Speech goes through speechSynthesis (Settings patches it to hold the "playback" audio session so it plays on silent);
   before the mic opens the audio session is released (TTSAudio.release), the same order speech.js uses. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic;
  const SR = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const KEY = 'hands.v1';
  const st = (() => { try { return Object.assign({ deck: '*', auto: true }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { deck: '*', auto: true }; } })();
  const saveSt = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  let S = null, rec = null, gen = 0;

  /* ---------- text helpers ---------- */
  const plain = h => String(h || '').replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, '. ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
  const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const LANG = { de: 'de-DE', fr: 'fr-FR', es: 'es-ES', en: 'en-US' };
  const SW = { de: 'der die das und ist nicht ich du er sie wir ein eine mit auf fur zu von den dem ich bin hast', fr: 'le la les est et je tu il elle nous pas une des du au avec pour que qui suis', es: 'el los las es y yo tu el ella no una unos con por para que soy estoy muy', en: 'the and is of to a in that it for with are this you what which' };
  function langOf(text, hint) {
    const t = String(text || ''); if (/[ñ¿¡]/i.test(t)) return 'es'; if (/[äöüß]/i.test(t)) return 'de'; if (/[çœèêëàâîôûù]/i.test(t)) return 'fr';
    const w = fold(t).split(' '); let best = hint || 'en', bs = 0;
    for (const k in SW) { const set = new Set(SW[k].split(' ')); const s = w.filter(x => set.has(x)).length; if (s > bs) { bs = s; best = k; } }
    return bs ? best : (hint || 'en');
  }
  function deckLang(deckId) {
    const d = typeof M !== 'undefined' && M.decks.get(deckId); const n = fold(d && d.name);
    if (/german|deutsch|goethe/.test(n)) return 'de'; if (/french|francais/.test(n)) return 'fr'; if (/spanish|espanol/.test(n)) return 'es'; return '';
  }
  function lev(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
  // score 0..1: best of whole-string similarity and the share of answer words heard; any of several answers (split on , ; / or) counts
  const ART = /^(the|a|an|to|der|die|das|den|dem|ein|eine|einen|le|la|les|l|un|une|des|el|los|las|lo|unos|unas)\s+/;
  const core = s => fold(s).replace(ART, '').replace(ART, '');
  function score(heard, answer) {
    const h = core(heard); if (!h) return 0;
    const alts = String(answer || '').split(/\s*(?:[;,/|]|\bor\b|\boder\b|\bou\b|\bo\b)\s*/i).map(core).filter(Boolean); if (!alts.length) return 0;
    let best = 0;
    for (const a of alts.concat([core(answer)])) {
      const sim = 1 - lev(h, a) / Math.max(h.length, a.length);
      const aw = a.split(' ').filter(w => w.length > 2 || a.split(' ').length === 1), hw = new Set(h.split(' '));
      const words = aw.length ? aw.filter(w => hw.has(w) || [...hw].some(x => x.length > 3 && 1 - lev(x, w) / Math.max(x.length, w.length) >= .75)).length / aw.length : 0;
      const contains = h.includes(a) ? 1 : 0;
      best = Math.max(best, sim, words * .95, contains);
    }
    return Math.max(0, Math.min(1, best));
  }
  /* what to read and what counts as the answer for one card */
  function parts(card) {
    const note = M.notes.get(card.nid); if (!note) return null;
    const hint = deckLang(card.deck);
    let q, a, expect;
    if (note.type === 'cloze') {
      q = plain(clozeRender(note.front, card.ord, false).replace(/\[(?:…|[^\]]*)\]/g, ' blank '));
      expect = plain((new RegExp('\\{\\{c' + card.ord + '::([\\s\\S]*?)(?:::[\\s\\S]*?)?\\}\\}').exec(note.front) || [])[1] || '');
      a = plain(clozeRender(note.front, card.ord, true));
    } else if (card.ord === 1) { q = plain(note.back); expect = a = plain(note.front); }
    else { q = plain(note.front); expect = a = plain(note.back); }
    if (a.length > 220) a = a.slice(0, 220).replace(/\s+\S*$/, '') + '…';
    return { q, a, expect, ql: langOf(q, hint), al: langOf(expect, hint) };
  }

  /* ---------- speech ---------- */
  function speak(text, lang, then) {
    const my = gen;
    try {
      if (!('speechSynthesis' in window) || !text) { if (then) setTimeout(() => my === gen && then(), 300); return; }
      speechSynthesis.cancel();
      const chunks = String(text).match(/[^.!?;]+[.!?;]*/g) || [text];
      chunks.forEach((c, i) => {
        const u = new SpeechSynthesisUtterance(c.trim()); u.lang = LANG[lang] || 'en-US'; u.rate = .95;
        if (i === chunks.length - 1) { let done = false; const fin = () => { if (done) return; done = true; if (my === gen && then) setTimeout(then, 250); }; u.onend = fin; u.onerror = fin; setTimeout(fin, 1500 + c.length * 110); }
        speechSynthesis.speak(u);
      });
    } catch (e) { if (then) setTimeout(() => my === gen && then(), 300); }
  }
  function stopAll() { gen++; try { speechSynthesis.cancel(); } catch (e) {} try { if (rec) rec.abort(); } catch (e) {} rec = null; try { window.TTSAudio && TTSAudio.release(); } catch (e) {} }
  function listen() {
    const C = SR(); if (!C || !S || S.noMic) { S.phase = 'wait'; paint(); return; }
    try { window.TTSAudio && TTSAudio.release(); } catch (e) {} // the mic needs the normal audio session back
    const my = gen;
    try {
      const r = new C(); rec = r; r.lang = LANG[S.p.al] || 'en-US'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 3;
      let best = '', got = false;
      r.onresult = ev => { let txt = ''; for (let i = 0; i < ev.results.length; i++) { const alts = [...ev.results[i]].map(x => x.transcript); txt += ' ' + (alts.sort((x, y) => score(y, S.p.expect) - score(x, S.p.expect))[0] || ''); } best = txt.trim(); S.heard = best; const h = S.el.querySelector('.hf-heard'); if (h) h.textContent = '“' + best + '”'; if (ev.results[ev.results.length - 1].isFinal) got = true; };
      r.onerror = ev => { if (my !== gen) return; if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { S.noMic = true; S.note = 'Mic is blocked, so use the buttons. (Settings › Safari › Microphone to allow it.)'; } };
      r.onend = () => { if (my !== gen || rec !== r) return; rec = null; if (best) judge(best); else { S.phase = 'wait'; paint(); } };
      r.start(); S.phase = 'listen'; S.heard = ''; paint();
    } catch (e) { S.phase = 'wait'; paint(); }
  }

  /* ---------- flow ---------- */
  function due(deck) { try { const c = scopeCounts(deck, Date.now()); return c.n + c.l + c.r; } catch (e) { return 0; } }
  function render(el) {
    stopAll(); S = { el, mode: 'menu', n: 0, ok: 0, noMic: false, note: '' };
    if (!el.__hf) { el.__hf = 1; el.addEventListener('click', onClick); }
    paint();
  }
  function decks() { return live(M.decks).map(d => ({ id: d.id, name: d.name, n: due(d.id) })).filter(d => d.n).sort((a, b) => b.n - a.n).slice(0, 30); }
  function paint() {
    if (!S || !S.el.isConnected) { stopAll(); return; }
    let h = '';
    if (S.mode === 'menu') {
      const ds = decks(), all = due('*');
      h = L.top('Hands-free review', '', 'tools') + `<p class="muted lb-p">I read each card out loud, you say the answer, I check it and read the right one back. Works with the screen off your hands. Phone on silent is fine.</p>
        ${SR() ? '' : '<p class="lb-note">Voice answers aren\'t available in this browser, so you\'ll answer with the big buttons.</p>'}
        <div class="lb-group">${[{ id: '*', name: 'Everything due', n: all }].concat(ds).map(d => `<button class="lb-row${st.deck === d.id ? ' on' : ''}" type="button" data-hf-deck="${esc(d.id)}"><span class="lb-ic">${ic(st.deck === d.id ? 'check' : 'book', 18)}</span><span class="lb-rt"><span class="t1">${esc(d.name)}</span><span class="t2">${d.n} due</span></span></button>`).join('')}</div>
        <label class="hf-auto"><input type="checkbox" data-hf-auto ${st.auto ? 'checked' : ''}> Listen for my answer automatically</label>
        <div class="lb-btns"><button class="btn pri hf-go" type="button" data-hf-start ${due(st.deck) ? '' : 'disabled'}>${ic('ear', 20)} Start</button></div>`;
    } else if (S.mode === 'end') {
      h = L.top('', '', 'tools') + `<div class="lb-card sim-res"><div class="lz-big">${S.ok}/${S.n}</div><div class="sim-verd ${S.n && S.ok / S.n >= .7 ? 'ok' : 'bad'}">${S.n ? (S.ok / S.n >= .7 ? 'Nice, all by ear' : 'Good reps') : 'Nothing due right now'}</div></div>
        <div class="lb-btns"><button class="btn" type="button" data-hf-menu>Done</button></div>`;
    } else {
      const p = S.p, ph = S.phase, show = ph === 'result';
      h = `<div class="lb-top"><button class="lb-back" type="button" data-hf-stop>${ic('back', 18)}<span>Stop</span></button><span class="lb-tr">${S.n} done · ${S.left} left</span></div>
        <div class="hf-stage ${ph}">
          <div class="hf-ring">${ic(ph === 'listen' ? 'ear' : ph === 'result' ? (S.g >= 3 ? 'check' : 'x') : 'book', 34)}</div>
          <div class="hf-st">${{ read: 'Reading the card…', listen: 'Listening… say your answer', wait: 'Your answer?', result: S.g >= 3 ? 'Got it' : S.g === 2 ? 'Close' : 'Not quite' }[ph] || ''}</div>
          <div class="hf-q" lang="${LANG[p.ql]}">${esc(p.q)}</div>
          <div class="hf-heard">${S.heard ? '“' + esc(S.heard) + '”' : ''}</div>
          ${show ? `<div class="hf-a" lang="${LANG[p.al]}">${esc(p.a)}</div>` : ''}
        </div>
        ${S.note ? `<p class="lb-note">${esc(S.note)}</p>` : ''}
        ${show ? `<div class="hf-grid"><button class="btn hf-big" type="button" data-hf-g="1">Again</button><button class="btn hf-big" type="button" data-hf-g="3">Good</button><button class="btn pri hf-big hf-wide" type="button" data-hf-next>Next card</button></div>`
          : `<div class="hf-grid">${SR() && !S.noMic ? `<button class="btn pri hf-big hf-wide" type="button" data-hf-mic>${ic('ear', 20)} ${ph === 'listen' ? 'Listening…' : 'Answer out loud'}</button>` : ''}<button class="btn hf-big" type="button" data-hf-repeat>Repeat</button><button class="btn hf-big" type="button" data-hf-reveal>Show answer</button></div>`}`;
    }
    S.el.innerHTML = `<div class="lb hf">${h}</div>`;
  }
  function start() { S.mode = 'play'; S.n = 0; S.ok = 0; S.deck = st.deck; nextCardHF(true); }
  function nextCardHF(first) {
    const nx = nextCard(S.deck, Date.now()); const card = nx.card;
    if (!card || S.n >= 50) { stopAll(); S.mode = 'end'; paint(); if (S.n) speak(S.ok + ' out of ' + S.n + '. Nice work.', 'en'); return; }
    S.card = card; S.p = parts(card); S.heard = ''; S.g = 0; S.phase = 'read'; S.left = due(S.deck); S.t0 = Date.now(); paint();
    speak(S.p.q, S.p.ql, () => { if (!S || S.mode !== 'play' || S.card !== card) return; if (st.auto && SR() && !S.noMic) listen(); else { S.phase = 'wait'; paint(); } });
  }
  function judge(heard) {
    const s = /^(skip|pass|i don.?t know|keine ahnung|je ne sais pas|no se|no lo se)$/i.test(fold(heard)) ? 0 : score(heard, S.p.expect);
    const g = s >= .78 ? 3 : s >= .5 ? 2 : 1; reveal(g, true);
  }
  function reveal(g, spoken) {
    stopAll(); S.g = g; S.phase = 'result'; paint();
    try { L.fx(g >= 3); } catch (e) {}
    const say = (g >= 3 ? (S.p.al === 'de' ? 'Richtig. ' : S.p.al === 'fr' ? 'Correct. ' : S.p.al === 'es' ? 'Correcto. ' : 'Correct. ') : '') + S.p.a;
    if (spoken) speak(say, S.p.al, () => { if (S && S.phase === 'result' && st.auto) commit(g); });
  }
  async function commit(g) {
    if (!S || !S.card) return; const card = S.card; S.card = null; stopAll();
    try {
      const now = Date.now(), prev = card, n = schedule(card, g, now);
      const rv = { id: 'r-' + rid(), cid: card.id, deck: card.deck, t: now, g, ps: prev.st || 0, ivl: n.st === 2 ? n.ivl : -Math.round((n.due - now) / MIN), took: Math.min(now - S.t0, 600000) };
      await write([['cards', n], ['revlog', rv]]);
      if (window.Hub) Hub.award(g === 1 ? 'again' : 'review'); if (g === 1 && window.Weak) Weak.addCard(card);
    } catch (e) { console.warn('hands commit', e); }
    S.n++; if (g >= 3) S.ok++;
    nextCardHF();
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    const d = t.closest('[data-hf-deck]'); if (d) { st.deck = d.dataset.hfDeck; saveSt(); paint(); return; }
    const a = t.closest('[data-hf-auto]'); if (a) { st.auto = a.checked; saveSt(); return; }
    if (t.closest('[data-hf-start]')) { start(); return; }
    if (t.closest('[data-hf-menu]')) { S.mode = 'menu'; paint(); return; }
    if (t.closest('[data-hf-stop]')) { stopAll(); S.mode = S.n ? 'end' : 'menu'; paint(); return; }
    if (S.mode !== 'play') return;
    if (t.closest('[data-hf-mic]')) { stopAll(); listen(); return; }
    if (t.closest('[data-hf-repeat]')) { stopAll(); S.phase = 'read'; paint(); const c = S.card; speak(S.p.q, S.p.ql, () => { if (S.card === c && st.auto && SR() && !S.noMic) listen(); else if (S.card === c) { S.phase = 'wait'; paint(); } }); return; }
    if (t.closest('[data-hf-reveal]')) { reveal(1, false); speak(S.p.a, S.p.al); return; }
    const g = t.closest('[data-hf-g]'); if (g) { commit(+g.dataset.hfG); return; }
    if (t.closest('[data-hf-next]')) { commit(S.g || 1); return; }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && S && S.mode === 'play') { stopAll(); S.phase = 'wait'; paint(); } });
  window.LabMods.hands = { render, score, langOf, parts, _S: () => S, _judge: judge };
})();
