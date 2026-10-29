/* Study tools (v179): Forgetting forecast, Teach-back, Mnemonic forge, Confidence tags, Neuron map, Exam countdown rebalancer,
   Lab value instinct, Pharmacology flight sim. Everything runs on this phone from your own cards and review history;
   new data stays on this phone (localStorage l20.*) and is not synced. Anything that is a heuristic says so on screen. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc; L.css2(); L.css3();
  if (!document.getElementById('l20css')) { const l = document.createElement('link'); l.id = 'l20css'; l.rel = 'stylesheet'; l.href = 'feat/lab/labs20.css?v=' + L.VER; document.head.appendChild(l); }
  function store(key) { const lk = 'l20.' + key; return { get(def) { try { const o = JSON.parse(localStorage.getItem(lk) || 'null'); return o && typeof o === 'object' ? o : def; } catch (e) { return def; } }, set(o) { o.at = Date.now(); try { localStorage.setItem(lk, JSON.stringify(o)); } catch (e) {} } }; }
  const plain = h => String(h || '').replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '$1').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|li)>/gi, '\n').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  function qa(c) {
    const n = M.notes.get(c.nid); if (!n) return { q: '', a: '' };
    if (n.type === 'cloze') { const num = +c.ord || 1, ans = []; const q = String(n.front || '').replace(/\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g, (m, k, x, hint) => { if (+k === num) { ans.push(x); return '[' + (hint || '…') + ']'; } return x; }); return { q: plain(q), a: plain(ans.join(', ')) + (n.back ? '\n' + plain(n.back) : '') }; }
    return c.ord === 1 ? { q: plain(n.back), a: plain(n.front) } : { q: plain(n.front), a: plain(n.back) };
  }
  const cards = (deck, f) => { const out = []; for (const c of M.cards.values()) { if (c.del) continue; const d = M.decks.get(c.deck); if (!d || d.del) continue; if (deck && deck !== '*' && c.deck !== deck) continue; if (f && !f(c)) continue; out.push(c); } return out; };
  const deckList = () => live(M.decks).sort((a, b) => a.name.localeCompare(b.name));
  const decksSel = (attr, cur, all = true) => `<select class="l20-sel" ${attr}>${all ? `<option value="*">All decks</option>` : ''}${deckList().map(d => `<option value="${esc(d.id)}"${cur === d.id ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select>`;
  const short = (s, n = 90) => { s = String(s || '').replace(/\s+/g, ' '); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const recallAt = (c, t) => (c.s && c.last) ? retr(Math.max(0, (t - c.last) / DAY), c.s) : null;
  const pct = x => Math.round(x * 100) + '%';
  function mount(el, key, onClick, onInput) { if (el['__l20m' + key]) return; el['__l20m' + key] = 1; el.addEventListener('click', e => { if (el.__l20 === key) onClick(e); }); if (onInput) el.addEventListener('change', e => { if (el.__l20 === key) onInput(e); }); }
  const head = (t, p) => L.top(t, '', 'tools') + (p ? `<p class="muted lb-p">${p}</p>` : '');
  const sendWeak = async ids => { let n = 0; if (!(window.Weak && Weak.addCard)) return 0; for (const id of ids) { const c = M.cards.get(id); if (c) { try { await Weak.addCard(c); n++; } catch (e) {} } } return n; };
  const fmtDay = t => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const STOP = new Set('the a an and or of to in on for with by is are was were be been it its this that these those as at from which who what when where how why not no but if then than into out up down over under about after before during between both each few more most other some such only own same so too very can will just do does did have has had having their there they them he she his her you your we our i me my also may might must shall should would could one two three per via eg ie etc called known used use uses type types form forms part'.split(' '));
  const words = s => String(s || '').toLowerCase().match(/[a-zäöüßéèàçñ0-9]+(?:-[a-z0-9]+)*/g) || [];
  const stem = w => w.length > 5 ? w.replace(/(ations|ation|ings|ing|ies|ied|ed|es|s)$/, '') : w.replace(/s$/, '');
  const keyTerms = s => [...new Set(words(s).filter(w => (w.length >= 4 || /\d/.test(w)) && !STOP.has(w)).map(stem))];

  /* ---------- 1. Forgetting forecast ---------- */
  const forg = { render(el) {
    el.__l20 = 'forg'; forg.el = el; forg.th = forg.th || 0.8; forg.deck = forg.deck || '*';
    mount(el, 'forg', async e => { const t = e.target.closest('[data-fg]'); if (!t) return; const a = t.dataset.fg;
      if (a === 'th') { forg.th = +t.dataset.v; fgDraw(); return; }
      if (a === 'weak') { const n = await sendWeak(forg.list.map(x => x.c.id)); toast(n ? n + ' cards sent to Weak Spots' : 'Weak Spots not available'); return; }
    }, e => { if (e.target.matches('[data-fg-deck]')) { forg.deck = e.target.value; fgDraw(); } });
    fgDraw();
  } };
  function fgDraw() {
    const el = forg.el; if (!el || !el.isConnected) return;
    const now = Date.now(), d0 = dayStart(now), th = forg.th, days = [];
    for (let i = 0; i < 7; i++) days.push({ i, t: d0 + i * DAY + 12 * HOUR, list: [] });
    const list = [];
    for (const c of cards(forg.deck, c => c.st === 2 && !c.susp && c.s && c.last)) {
      const r0 = recallAt(c, now); let day = null;
      if (r0 < th) day = 0; else for (const d of days) { const r = recallAt(c, d.t); if (r < th) { day = d.i; break; } }
      if (day == null) continue;
      const x = { c, day, now: r0, end: recallAt(c, d0 + 7 * DAY), due: c.due }; days[day].list.push(x); list.push(x);
    }
    forg.list = list;
    const tot = cards(forg.deck, c => c.st === 2 && !c.susp && c.s).length;
    let h = head('Forgetting forecast', `Which cards will slip below ${pct(th)} recall this week if you don't review them, worked out from your own review history with the same memory model that schedules your cards.`);
    h += `<div class="l20-row">${decksSel('data-fg-deck', forg.deck)}<div class="lb-seg l20-seg">${[0.7, 0.8, 0.9].map(v => `<button type="button" class="${v === th ? 'on' : ''}" data-fg="th" data-v="${v}">${pct(v)}</button>`).join('')}</div></div>`;
    if (!tot) h += `<div class="lb-empty">No reviewed cards yet. Study a few days and the forecast fills in.</div>`;
    else {
      h += `<div class="lb-card"><h3>${list.length} of ${tot} cards will fade this week</h3><div class="l20-week">${days.map(d => `<div><b style="height:${Math.min(100, d.list.length ? 8 + d.list.length / Math.max(1, list.length) * 92 : 0)}%"></b><span>${d.i === 0 ? 'Now' : new Date(d.t).toLocaleDateString(undefined, { weekday: 'narrow' })}</span><em>${d.list.length}</em></div>`).join('')}</div></div>`;
      if (list.length) h += `<button type="button" class="btn pri lb-wide" data-fg="weak">Send all ${list.length} to Weak Spots</button>`;
      for (const d of days) { if (!d.list.length) continue; d.list.sort((a, b) => a.now - b.now);
        h += `<div class="mx-h">${d.i === 0 ? 'Already fading' : fmtDay(d.t)} · ${d.list.length}</div><div class="lb-group">${d.list.slice(0, 30).map(x => `<div class="lb-row"><span class="lb-rt"><span class="t1">${esc(short(qa(x.c).q))}</span><span class="t2">${esc((M.decks.get(x.c.deck) || {}).name || '')} · recall now ${pct(x.now)} · ${x.due <= now ? 'due now' : 'due ' + fmtDay(x.due)}</span></span></div>`).join('')}${d.list.length > 30 ? `<div class="lb-row"><span class="t2">+${d.list.length - 30} more</span></div>` : ''}</div>`; }
    }
    el.innerHTML = `<div class="lb">${h}<p class="lb-foot">Estimates from the FSRS memory model, assuming no review in between. Your normal reviews will catch most of these; this shows what's at risk if you skip days.</p></div>`;
  }

  /* ---------- 2. Teach-back ---------- */
  const TS = store('teach');
  const teach = { render(el) {
    el.__l20 = 'teach'; teach.el = el; teach.R = null;
    mount(el, 'teach', async e => { const t = e.target.closest('[data-tb]'); if (!t) return; const a = t.dataset.tb;
      if (a === 'go') { const dk = el.querySelector('[data-tb-deck]') ? el.querySelector('[data-tb-deck]').value : '*'; const pool = L.shuffle(cards(dk, c => !c.susp && keyTerms(qa(c).a).length >= 3)); if (!pool.length) { toast('No cards with a long enough answer in that deck'); return; } teach.R = { id: pool[0].id, deck: dk }; tbDraw(); return; }
      if (a === 'grade' && teach.R) { const tx = (el.querySelector('[data-tb-text]') || {}).value || ''; if (tx.trim().length < 3) { toast('Explain it first'); return; } teach.R.text = tx; teach.R.graded = 1; tbScore(); tbDraw(); return; }
      if (a === 'weak' && teach.R) { const n = await sendWeak([teach.R.id]); toast(n ? 'Sent to Weak Spots' : 'Weak Spots not available'); return; }
      if (a === 'next' && teach.R) { const dk = teach.R.deck; teach.R = null; tbDraw(); const b = el.querySelector('[data-tb-deck]'); if (b) b.value = dk; el.querySelector('[data-tb="go"]').click(); return; }
      if (a === 'home') { teach.R = null; tbDraw(); }
    });
    tbDraw();
  } };
  function tbScore() {
    const R = teach.R, c = M.cards.get(R.id), key = keyTerms(qa(c).a), mine = new Set(keyTerms(R.text));
    const hit = key.filter(w => mine.has(w) || [...mine].some(m => m.length >= 5 && (m.startsWith(w) || w.startsWith(m))));
    R.key = key; R.hit = hit; R.miss = key.filter(w => !hit.includes(w)); R.score = key.length ? hit.length / key.length : 0;
    const D = TS.get({ log: [] }); D.log.push({ cid: R.id, s: Math.round(R.score * 100), t: Date.now() }); D.log = D.log.slice(-300); TS.set(D);
    L.fx(R.score >= 0.6);
  }
  function tbDraw() {
    const el = teach.el, R = teach.R; if (!el || !el.isConnected) return; let h;
    if (!R) { const D = TS.get({ log: [] }), avg = D.log.length ? Math.round(D.log.slice(-20).reduce((s, x) => s + x.s, 0) / Math.min(20, D.log.length)) : null;
      h = head('Teach-back', 'Pick a card and explain it as if you were teaching a friend. Say it out loud with the mic on your keyboard, or type it. Synapse then shows which key ideas from the answer you covered and which you left out.') +
        `${avg != null ? `<div class="lb-card"><p>Last ${Math.min(20, D.log.length)} explanations: <b>${avg}%</b> of key ideas covered</p></div>` : ''}<div class="l20-row">${decksSel('data-tb-deck', '*')}<button type="button" class="btn pri" data-tb="go">Teach a card</button></div>`; }
    else { const c = M.cards.get(R.id), x = qa(c);
      h = L.top('', '', 'tools') + `<div class="l20-k">Teach this</div><div class="lb-card l8-q">${esc(x.q).replace(/\n/g, '<br>')}</div>`;
      if (!R.graded) h += `<textarea class="l20-in l20-big" data-tb-text rows="6" maxlength="3000" placeholder="Explain it in your own words. Tip: tap the 🎤 on your keyboard to say it out loud."></textarea><button type="button" class="btn pri lb-wide" data-tb="grade">Grade my explanation</button>`;
      else { const sc = Math.round(R.score * 100);
        h += `<div class="lb-card ${sc >= 60 ? 'l20-good' : 'l20-badc'}"><h3>${sc}% of the key ideas</h3><p class="small muted">${R.hit.length} of ${R.key.length} key words from the answer showed up in what you said.</p></div>
          ${R.miss.length ? `<div class="l20-k">You left out</div><div class="l20-terms">${R.miss.map(w => `<span class="miss">${esc(w)}</span>`).join('')}</div>` : ''}
          ${R.hit.length ? `<div class="l20-k">You covered</div><div class="l20-terms">${R.hit.map(w => `<span class="hit">${esc(w)}</span>`).join('')}</div>` : ''}
          <div class="l20-k">The card's answer</div><div class="lb-card l8-a">${esc(x.a).replace(/\n/g, '<br>')}</div><div class="l20-k">What you said</div><div class="lb-card"><p class="small">${esc(R.text).replace(/\n/g, '<br>')}</p></div>
          <div class="lb-btns"><button type="button" class="btn" data-tb="weak">To Weak Spots</button><button type="button" class="btn pri" data-tb="next">Next card</button></div>`; }
      h += `<button type="button" class="btn ghost lb-wide" data-tb="home">Stop</button>`; }
    el.innerHTML = `<div class="lb">${h}<p class="lb-foot">Grading is word matching against the card's answer, done on this phone: it checks which key ideas you named, not whether your explanation is right. No AI, nothing leaves the phone.</p></div>`;
  }

  /* ---------- 3. Mnemonic forge ---------- */
  const BANK = { // [adjective, noun, verb] word lists per letter, deliberately odd
    a: [['angry', 'awkward', 'ancient'], ['aardvarks', 'astronauts', 'accordions'], ['argue', 'applaud', 'ambush']], b: [['bald', 'bouncy', 'bewildered'], ['badgers', 'bishops', 'burritos'], ['burp', 'bake', 'bully']],
    c: [['crunchy', 'cosmic', 'cranky'], ['camels', 'clowns', 'cupcakes'], ['cuddle', 'chase', 'carve']], d: [['dizzy', 'damp', 'dramatic'], ['dragons', 'dentists', 'donuts'], ['dance', 'devour', 'dribble']],
    e: [['electric', 'eager', 'enormous'], ['emus', 'elves', 'eggplants'], ['eat', 'escape', 'echo']], f: [['fluffy', 'furious', 'fancy'], ['flamingos', 'farmers', 'falafels'], ['fling', 'fax', 'fumble']],
    g: [['grumpy', 'glittery', 'gigantic'], ['goats', 'grandmas', 'gnomes'], ['gargle', 'gobble', 'grill']], h: [['hairy', 'hungry', 'haunted'], ['hamsters', 'hippos', 'hedgehogs'], ['hug', 'heckle', 'hum']],
    i: [['icy', 'itchy', 'invisible'], ['iguanas', 'inventors', 'igloos'], ['ignore', 'inflate', 'imitate']], j: [['jolly', 'jumpy', 'jealous'], ['jellyfish', 'jugglers', 'jaguars'], ['juggle', 'jiggle', 'judge']],
    k: [['kooky', 'kind', 'knobbly'], ['koalas', 'kings', 'kettles'], ['kick', 'kiss', 'knit']], l: [['lazy', 'loud', 'lumpy'], ['llamas', 'lawyers', 'lobsters'], ['lick', 'launch', 'lasso']],
    m: [['moody', 'muddy', 'massive'], ['monkeys', 'mermaids', 'muffins'], ['munch', 'mop', 'moonwalk']], n: [['nervous', 'naughty', 'nifty'], ['narwhals', 'ninjas', 'noodles'], ['nibble', 'nudge', 'nap']],
    o: [['odd', 'oily', 'overjoyed'], ['otters', 'owls', 'octopuses'], ['ogle', 'outrun', 'order']], p: [['purple', 'prickly', 'polite'], ['penguins', 'pirates', 'pickles'], ['poke', 'paint', 'pester']],
    q: [['quirky', 'quiet', 'queasy'], ['quokkas', 'queens', 'quilts'], ['quiz', 'quack', 'quarrel']], r: [['rusty', 'rowdy', 'radioactive'], ['raccoons', 'robots', 'radishes'], ['rattle', 'roast', 'rescue']],
    s: [['sticky', 'sleepy', 'sparkly'], ['sloths', 'surgeons', 'sausages'], ['sneeze', 'slurp', 'serenade']], t: [['tiny', 'toxic', 'thirsty'], ['turtles', 'tubas', 'tacos'], ['tickle', 'toss', 'tango']],
    u: [['ugly', 'upset', 'ultra'], ['unicorns', 'uncles', 'umbrellas'], ['unwrap', 'upset', 'untie']], v: [['vain', 'velvet', 'violent'], ['vampires', 'vikings', 'volcanoes'], ['vacuum', 'visit', 'veto']],
    w: [['wobbly', 'wild', 'wet'], ['walruses', 'wizards', 'waffles'], ['wiggle', 'whisper', 'wrestle']], x: [['xtra', 'xenial', 'x-rated'], ['xylophones', 'x-rays', 'xenon lamps'], ['x-ray', 'xerox', 'x out']],
    y: [['yellow', 'yummy', 'yawning'], ['yaks', 'yodelers', 'yoghurts'], ['yell', 'yank', 'yodel']], z: [['zany', 'zesty', 'zigzag'], ['zebras', 'zombies', 'zucchinis'], ['zap', 'zoom', 'zip']]
  };
  const FS = store('forge');
  // a "list card": 3 to 10 short items, one per line, or a comma/semicolon list with no sentences in it
  function listItems(a) {
    const raw = String(a || '').trim(); let p = raw.split(/\n+/).map(s => s.replace(/^\s*(?:[-•*·]|\d+[.)])\s*/, '').trim()).filter(Boolean), max = 6;
    if (p.length < 3) { if (/[:.!?]\s|\(/.test(raw.replace(/\n/g, ' ') + ' ')) return null; p = raw.replace(/\n/g, ' ').split(/\s*[,;]\s*|\s+and\s+(?=[^,;]*$)/i).map(s => s.replace(/^and\s+/i, '').trim()).filter(Boolean); max = 4; }
    p = p.map(s => s.replace(/[.:;,]+$/, ''));
    return p.length >= 3 && p.length <= 10 && p.every(s => s.split(/\s+/).length <= max && /[a-z]/i.test(s)) ? p : null;
  }
  const initial = s => { const w = String(s).replace(/^(the|a|an)\s+/i, '').match(/[a-z]/i); return w ? w[0].toLowerCase() : 'x'; };
  function forgeLine(items, seed) {
    let r = seed >>> 0; const rnd = n => { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return (r >>> 8) % n; };
    return items.map((it, i) => { const ch = initial(it), b = BANK[ch] || BANK.x, type = [0, 1, 2][i % 3], list = b[type]; const w = list[rnd(list.length)]; return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
  }
  const forge = { render(el) {
    el.__l20 = 'forge'; forge.el = el; forge.R = null;
    mount(el, 'forge', e => { const t = e.target.closest('[data-fo]'); if (!t) return; const a = t.dataset.fo;
      if (a === 'card') { const c = M.cards.get(t.dataset.id); const it = c && listItems(qa(c).a); if (it) { forge.R = { cid: c.id, q: qa(c).q, items: it, seed: (Date.now() & 0xffff) }; foDraw(); window.scrollTo(0, 0); } return; }
      if (a === 'own') { const tx = (el.querySelector('[data-fo-own]') || {}).value || ''; const it = listItems(tx); if (!it) { toast('Give 3 to 10 items, one per line or separated by commas'); return; } forge.R = { cid: null, q: 'Your list', items: it, seed: (Date.now() & 0xffff) }; foDraw(); return; }
      if (a === 'again' && forge.R) { forge.R.seed += 7919; foDraw(); return; }
      if (a === 'save' && forge.R && forge.R.cid) { const D = FS.get({ by: {} }); D.by[forge.R.cid] = forgeLine(forge.R.items, forge.R.seed); FS.set(D); toast('Saved with the card (on this phone)'); foDraw(); return; }
      if (a === 'home') { forge.R = null; foDraw(); }
    });
    foDraw();
  } };
  function foDraw() {
    const el = forge.el, R = forge.R; if (!el || !el.isConnected) return; let h;
    if (!R) {
      const found = []; for (const c of cards('*', c => !c.susp)) { if (found.length >= 40) break; const x = qa(c); if (listItems(x.a)) found.push({ c, x }); }
      const D = FS.get({ by: {} });
      h = head('Mnemonic forge', 'Turns any list card into a weird, memorable sentence: each word starts with the same letter as an item on the list. Don’t like it? Reforge until one sticks.') +
        `<div class="lb-card"><div class="l20-k">Forge your own list</div><textarea class="l20-in" data-fo-own rows="3" maxlength="600" placeholder="One item per line, or separated by commas"></textarea><button type="button" class="btn pri lb-wide" data-fo="own">Forge it</button></div>` +
        `<div class="mx-h">List cards in your decks (${found.length}${found.length >= 40 ? '+' : ''})</div>` + (found.length ? `<div class="lb-group">${found.map(f => `<button type="button" class="lb-row" data-fo="card" data-id="${esc(f.c.id)}"><span class="lb-rt"><span class="t1">${esc(short(f.x.q, 80))}</span><span class="t2">${D.by[f.c.id] ? '⚒ ' + esc(D.by[f.c.id]) : listItems(f.x.a).length + ' items'}</span></span><span class="lb-chev">${L.ic('chev', 16)}</span></button>`).join('')}</div>` : `<div class="lb-card"><p class="small muted">No list-style cards found yet (an answer with 3 to 10 items on separate lines or separated by commas).</p></div>`);
    } else {
      const line = forgeLine(R.items, R.seed), ws = line.split(' ');
      h = L.top('', '', 'tools') + `<div class="l20-k">${esc(short(R.q, 140))}</div><div class="lb-card l20-forge"><p class="l20-line">${ws.map(w => `<span><b>${esc(w.charAt(0))}</b>${esc(w.slice(1))}</span>`).join(' ')}</p></div>
        <div class="lb-group">${R.items.map((it, i) => `<div class="lb-row"><span class="l20-let">${esc(initial(it).toUpperCase())}</span><span class="lb-rt"><span class="t1">${esc(it)}</span><span class="t2">${esc(ws[i] || '')}</span></span></div>`).join('')}</div>
        <div class="lb-btns"><button type="button" class="btn" data-fo="again">Reforge</button>${R.cid ? `<button type="button" class="btn pri" data-fo="save">Keep this one</button>` : ''}</div><button type="button" class="btn ghost lb-wide" data-fo="home">Back</button>`;
    }
    el.innerHTML = `<div class="lb">${h}</div>`;
  }

  /* ---------- 4. Confidence tags (report; the tags themselves are added in review by feat/lab/ctag.js) ---------- */
  const CT = () => (window.CTag ? CTag.get() : { on: 0, log: [] });
  const ctag = { render(el) {
    el.__l20 = 'ctag'; ctag.el = el;
    mount(el, 'ctag', e => { const t = e.target.closest('[data-ctg]'); if (!t || !window.CTag) return; const a = t.dataset.ctg;
      if (a === 'toggle') { CTag.setOn(!CT().on); ctDraw(); return; }
      if (a === 'clear') { if (confirm('Clear all confidence tags?')) { CTag.clear(); ctDraw(); } }
    });
    ctDraw();
  } };
  function ctDraw() {
    const el = ctag.el; if (!el || !el.isConnected) return; const D = CT(), log = D.log || [];
    const by = {}; for (const x of log) { const k = x.deck; const o = by[k] || (by[k] = { n: 0, s: 0, sm: 0, g: 0, gk: 0 }); o.n++; if (x.l === 3) { o.s++; if (x.g === 1) o.sm++; } if (x.l === 1) { o.g++; if (x.g >= 3) o.gk++; } }
    const rows = Object.entries(by).map(([k, o]) => ({ k, name: (M.decks.get(k) || {}).name || 'Deleted deck', ...o, over: o.s ? o.sm / o.s : 0 })).sort((a, b) => b.over - a.over || b.s - a.s);
    const flagged = rows.filter(r => r.s >= 5 && r.over >= 0.2);
    const sureMiss = {}; log.filter(x => x.l === 3 && x.g === 1).forEach(x => { sureMiss[x.cid] = (sureMiss[x.cid] || 0) + 1; });
    const worst = Object.entries(sureMiss).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id, n]) => ({ c: M.cards.get(id), n })).filter(x => x.c && !x.c.del);
    let h = head('Confidence tags', 'Turn this on and every card in normal review gets three small buttons before you flip it: Guess, Think so, Sure. Synapse then finds the topics where your “Sure” keeps turning into “Again”.') +
      `<div class="lb-card l20-toggle"><span><b>Confidence tags in review</b><br><small class="muted">${D.on ? 'On: tap how sure you are before Show answer (optional).' : 'Off'}</small></span><button type="button" class="btn ${D.on ? '' : 'pri'}" data-ctg="toggle">${D.on ? 'Turn off' : 'Turn on'}</button></div>`;
    if (!log.length) h += `<div class="lb-empty">No tagged reviews yet.${D.on ? ' Do a review session and tag a few cards.' : ''}</div>`;
    else {
      h += `<div class="mx-h">Overconfident topics</div>` + (flagged.length ? `<div class="lb-group">${flagged.map(r => `<div class="lb-row l20-res bad"><span class="lb-rt"><span class="t1">${esc(r.name)}</span><span class="t2">“Sure” but Again ${r.sm} of ${r.s} times (${pct(r.over)})</span></span></div>`).join('')}</div>` : `<div class="lb-card"><p class="small">None yet. A deck is flagged once you've said “Sure” 5+ times and missed 20% or more of those.</p></div>`);
      h += `<div class="mx-h">Every deck you've tagged</div><div class="lb-card">${rows.map(r => `<div class="l20-bar"><span>${esc(short(r.name, 22))}</span><i><b style="width:${Math.round(r.over * 100)}%"></b></i><em>${r.s ? pct(r.over) : '–'} <small>(${r.s} sure)</small></em></div>`).join('')}<p class="small muted" style="margin-top:8px">Bar = how often a “Sure” ended in Again.</p></div>`;
      const gs = rows.reduce((s, r) => s + r.g, 0), gk = rows.reduce((s, r) => s + r.gk, 0);
      if (gs >= 10) h += `<div class="lb-card"><p class="small">When you tag “Guess” you still get it right ${pct(gk / gs)} of the time${gk / gs >= 0.6 ? ': you know more than you think' : ''}.</p></div>`;
      if (worst.length) h += `<div class="mx-h">Cards you were sure about and missed</div><div class="lb-group">${worst.map(w => `<div class="lb-row"><span class="lb-rt"><span class="t1">${esc(short(qa(w.c).q))}</span><span class="t2">missed while “Sure” ×${w.n}</span></span></div>`).join('')}</div>`;
      h += `<button type="button" class="btn ghost lb-wide" data-ctg="clear">Clear tags</button>`;
    }
    el.innerHTML = `<div class="lb">${h}<p class="lb-foot">Tags stay on this phone and never change your review schedule.</p></div>`;
  }

  /* ---------- 5. Neuron map ---------- */
  const REG = [[105, 92, 'Prefrontal'], [180, 66, 'Frontal'], [262, 70, 'Parietal'], [325, 125, 'Occipital'], [110, 168, 'Motor'], [192, 146, 'Temporal'], [272, 160, 'Cerebellum'], [196, 218, 'Brainstem']];
  const neuron = { render(el) { el.__l20 = 'neuron'; neuron.el = el; nmDraw(); } };
  function nmDraw() {
    const el = neuron.el; if (!el || !el.isConnected) return; const now = Date.now();
    const per = {}; for (const c of cards('*', c => !c.susp)) { const o = per[c.deck] || (per[c.deck] = { n: 0, m: 0, seen: 0 }); o.n++; if (c.st >= 1) o.seen++; if (c.st === 2) { const r = recallAt(c, now); if (r != null && r >= 0.9 && (c.ivl || 0) >= 7) o.m++; } }
    const ds = Object.entries(per).map(([id, o]) => ({ id, name: (M.decks.get(id) || {}).name || '', ...o })).sort((a, b) => b.n - a.n).slice(0, REG.length);
    let h = head('Neuron map', 'Your progress as a growing brain. Each region is one of your decks; it lights up as cards become solid, and grows a neuron for each one you’ve really learned.');
    if (!ds.length) { el.innerHTML = `<div class="lb">${h}<div class="lb-empty">Add a deck and study a few cards to start growing your brain.</div></div>`; return; }
    const maxN = Math.max(...ds.map(d => d.n));
    let svg = `<svg viewBox="0 0 400 260" class="l20-brain" role="img" aria-label="Brain map of your decks"><path class="l20-cortex" d="M60 150C40 95 85 35 160 28c55-6 95 2 140 30 45 28 70 70 55 115-10 30-40 45-70 47-15 30-55 38-85 28-35 12-75 5-100-20-30 0-50-35-40-78z"/>`;
    ds.forEach((d, i) => {
      const [x, y] = REG[i], m = d.n ? d.m / d.n : 0, r = 15 + 17 * Math.sqrt(d.n / maxN), nn = Math.min(24, d.m);
      svg += `<g class="l20-reg" style="--m:${(0.15 + 0.85 * m).toFixed(2)}"><circle cx="${x}" cy="${y}" r="${r.toFixed(1)}"/>`;
      let s = (d.id.length * 97 + i * 31) >>> 0; const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return ((s >>> 8) % 1000) / 1000; };
      const pts = []; for (let k = 0; k < nn; k++) { const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * (r - 6); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
      pts.forEach((p, k) => { if (k) { const q = pts[Math.floor(rnd() * k)]; svg += `<line x1="${q[0].toFixed(1)}" y1="${q[1].toFixed(1)}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}"/>`; } });
      pts.forEach(p => { svg += `<circle class="n" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6"/>`; });
      svg += `<text x="${x}" y="${(y + 4).toFixed(1)}">${i + 1}</text></g>`;
    });
    svg += '</svg>';
    const tot = ds.reduce((s, d) => s + d.m, 0), all = ds.reduce((s, d) => s + d.n, 0);
    h += `<div class="lb-card l20-brainc">${svg}<p class="small muted">${tot} neurons grown · ${all ? pct(tot / all) : '0%'} of these cards solid</p></div>
      <div class="lb-group">${ds.map((d, i) => `<div class="lb-row"><span class="l20-let">${i + 1}</span><span class="lb-rt"><span class="t1">${esc(d.name)}</span><span class="t2">${REG[i][2]} region · ${d.m}/${d.n} solid · ${d.seen} studied</span></span><span class="lb-best">${d.n ? pct(d.m / d.n) : '–'}</span></div>`).join('')}</div>`;
    el.innerHTML = `<div class="lb">${h}<p class="lb-foot">“Solid” = a review card you'd recall with 90%+ chance right now and an interval of a week or more. Your ${REG.length} biggest decks are shown.</p></div>`;
  }

  /* ---------- 6. Exam countdown planner (rebalance reviews before a test date) ---------- */
  const RB = store('cram');
  const pad2 = n => String(n).padStart(2, '0'), keyOf = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  function nextExam() { try { const p = JSON.parse(localStorage.getItem('plan.v1') || 'null'); const tk = keyOf(new Date(Date.now() - 4 * HOUR)); const ex = ((p && p.exams) || []).filter(x => x.date && x.date > tk).sort((a, b) => a.date.localeCompare(b.date))[0]; return ex || null; } catch (e) { return null; } }
  const cram = { render(el) {
    el.__l20 = 'cram'; cram.el = el; const ex = nextExam(), D = RB.get({});
    cram.date = cram.date || D.date || (ex ? ex.date : keyOf(new Date(Date.now() + 14 * DAY))); cram.deck = cram.deck || D.deck || (ex && ex.decks && ex.decks.length === 1 ? ex.decks[0] : '*'); cram.cap = cram.cap || D.cap || 0;
    mount(el, 'cram', async e => { const t = e.target.closest('[data-rb]'); if (!t) return; const a = t.dataset.rb;
      if (a === 'apply') { await rbApply(); return; }
      if (a === 'undo') { await rbUndo(); return; }
    }, e => { if (e.target.matches('[data-rb-date]')) cram.date = e.target.value; if (e.target.matches('[data-rb-deck]')) cram.deck = e.target.value; rbDraw(); });
    rbDraw();
  } };
  function rbPlan() {
    const [y, m, d] = String(cram.date || '').split('-').map(Number); if (!y) return null;
    const now = Date.now(), d0 = dayStart(now), examStart = dayStart(new Date(y, m - 1, d, 12).getTime()), days = Math.round((examStart - d0) / DAY);
    if (days < 1) return { days };
    const scope = cards(cram.deck, c => c.st === 2 && !c.susp);
    const load = Array(days).fill(0); // reviews already due on each day before the exam (overdue folded into today)
    const move = [];
    for (const c of scope) { if (c.due < examStart) load[Math.max(0, Math.round((dayStart(c.due) - d0) / DAY))]++; else move.push(c); }
    const before = load.slice();
    // move each card that would not come up before the exam onto the least-loaded day (weakest-at-exam first, earlier days on ties), never today
    move.sort((a, b) => (recallAt(a, examStart) || 0) - (recallAt(b, examStart) || 0));
    const first = days > 1 ? 1 : 0, assign = [];
    for (const c of move) { let bi = first; for (let i = first; i < days; i++) if (load[i] < load[bi]) bi = i; load[bi]++; assign.push({ c, day: bi }); }
    return { days, examStart, before, after: load, assign, scope: scope.length };
  }
  function rbDraw() {
    const el = cram.el; if (!el || !el.isConnected) return; const P = rbPlan(), D = RB.get({});
    let h = head('Exam countdown planner', 'Enter your test date. Cards whose next review would land after the exam are pulled forward and spread evenly over the days you have left, so everything gets one more look before test day without a pile-up.');
    h += `<div class="lb-card"><label class="l20-lab">Exam date<input type="date" class="l20-in" data-rb-date value="${esc(cram.date)}"></label><label class="l20-lab">Deck${decksSel('data-rb-deck', cram.deck)}</label></div>`;
    if (!P) h += `<div class="lb-empty">Pick a date.</div>`;
    else if (P.days < 1) h += `<div class="lb-empty">That date is today or in the past. Pick a future exam date.</div>`;
    else {
      const mx = Math.max(1, ...P.after), daysShown = Math.min(P.days, 30), bmax = Math.max(...P.before.slice(0, daysShown), 0), amax = Math.max(...P.after.slice(0, daysShown), 0);
      h += `<div class="lb-card"><h3>${P.days} day${P.days === 1 ? '' : 's'} to go</h3><p>${P.assign.length} of ${P.scope} review cards would not come up again before the exam.${P.assign.length ? ` After rebalancing your busiest day is <b>${amax}</b> reviews (was ${bmax} before the extra cards).` : ''}</p>
        <div class="l20-cal">${P.after.slice(0, daysShown).map((n, i) => `<div title="${n}"><b class="a" style="height:${Math.round(n / mx * 100)}%"></b><b class="b" style="height:${Math.round(P.before[i] / mx * 100)}%"></b><span>${i === 0 ? 'T' : new Date(P.examStart - (P.days - i) * DAY).getDate()}</span></div>`).join('')}</div>
        <p class="small muted"><span class="l20-key b"></span> already due <span class="l20-key a"></span> after rebalancing${P.days > 30 ? ' · first 30 days shown' : ''}</p></div>`;
      if (P.assign.length) h += `<button type="button" class="btn pri lb-wide" data-rb="apply">Rebalance ${P.assign.length} card${P.assign.length === 1 ? '' : 's'}</button>`;
      else h += `<div class="lb-card l20-good"><p>Every card in this deck already comes up before the exam. Nothing to move.</p></div>`;
    }
    if (D.undo && D.undo.length) h += `<button type="button" class="btn ghost lb-wide" data-rb="undo">Undo last rebalance (${D.undo.length} cards, ${new Date(D.when).toLocaleDateString()})</button>`;
    el.innerHTML = `<div class="lb">${h}<p class="lb-foot">Only due dates move; nothing else about a card changes, and you can undo. Reviewing early grows memory a little less than on time, but keeps it fresh for test day. Your Exam planner (Study tools) still sets the daily new-card plan.</p></div>`;
  }
  async function rbApply() {
    const P = rbPlan(); if (!P || !P.assign || !P.assign.length) return; const d0 = dayStart(Date.now());
    const undo = [], list = [];
    for (const { c, day } of P.assign) { const cur = M.cards.get(c.id); if (!cur || cur.del) continue; undo.push({ id: c.id, due: cur.due }); list.push(['cards', { ...cur, due: d0 + day * DAY }]); }
    if (!list.length) return;
    await write(list); RB.set({ date: cram.date, deck: cram.deck, undo, when: Date.now() }); toast(list.length + ' cards rebalanced'); rbDraw();
  }
  async function rbUndo() {
    const D = RB.get({}); if (!D.undo || !D.undo.length) return; const list = [];
    for (const u of D.undo) { const cur = M.cards.get(u.id); if (cur && !cur.del) list.push(['cards', { ...cur, due: u.due }]); }
    if (list.length) await write(list); D.undo = []; RB.set(D); toast('Rebalance undone'); rbDraw();
  }

  /* ---------- 7. Lab value instinct ---------- */
  const LABS = [ // name, unit, low, high, decimals (same reference ranges as the Lab panel reader)
    ['Sodium', 'mmol/L', 135, 145, 0], ['Potassium', 'mmol/L', 3.5, 5.0, 1], ['Chloride', 'mmol/L', 98, 106, 0], ['Bicarbonate', 'mmol/L', 22, 28, 0], ['BUN', 'mg/dL', 7, 20, 0], ['Creatinine', 'mg/dL', 0.6, 1.2, 1], ['Glucose', 'mg/dL', 70, 140, 0], ['Calcium', 'mg/dL', 8.5, 10.5, 1],
    ['WBC', '×10³/µL', 4.5, 11.0, 1], ['Hemoglobin', 'g/dL', 13.5, 17.5, 1, 'M'], ['Hemoglobin', 'g/dL', 12.0, 15.5, 1, 'F'], ['Platelets', '×10³/µL', 150, 400, 0], ['MCV', 'fL', 80, 100, 0],
    ['pH', '', 7.35, 7.45, 2], ['PaCO2', 'mmHg', 35, 45, 0], ['PaO2', 'mmHg', 80, 100, 0], ['ALT', 'U/L', 7, 56, 0], ['AST', 'U/L', 10, 40, 0], ['Total bilirubin', 'mg/dL', 0.1, 1.2, 1], ['Albumin', 'g/dL', 3.5, 5.0, 1]
  ];
  const IS = store('instinct');
  const fix = (v, dp) => (Math.round(v * Math.pow(10, dp)) / Math.pow(10, dp)).toFixed(dp);
  function makePanel() {
    const sex = Math.random() < 0.5 ? 'M' : 'F', pool = L.shuffle(LABS.filter(r => !r[5] || r[5] === sex)).slice(0, 5);
    const abn = Math.random() < 0.5 ? 0 : Math.random() < 0.75 ? 1 : 2, bad = new Set(L.shuffle([0, 1, 2, 3, 4]).slice(0, abn));
    const rows = pool.map((r, i) => { const [name, unit, lo, hi, dp] = r, span = hi - lo; let v;
      if (bad.has(i)) { const up = name === 'Total bilirubin' || name === 'ALT' || name === 'AST' ? true : Math.random() < 0.5; v = up ? hi + span * (0.15 + Math.random() * 0.6) : lo - span * (0.15 + Math.random() * 0.5); if (name === 'pH') v = up ? hi + 0.03 + Math.random() * 0.1 : lo - 0.03 - Math.random() * 0.12; if (v <= 0) v = hi + span * 0.3; }
      else v = lo + span * (0.12 + Math.random() * 0.76);
      const s = fix(v, dp), n = +s; return { name, unit, lo, hi, dp, v: s, flag: n < lo ? 'L' : n > hi ? 'H' : '' }; });
    return { sex, rows, abnormal: rows.some(r => r.flag) };
  }
  const instinct = { render(el) {
    el.__l20 = 'instinct'; instinct.el = el; instinct.R = null; clearTimeout(instinct.tm);
    mount(el, 'instinct', e => { const t = e.target.closest('[data-in]'); if (!t) return; const a = t.dataset.in, R = instinct.R;
      if (a === 'start') { const D = IS.get({ best: 0, sec: 3 }); instinct.R = { i: 0, n: 10, ok: 0, sec: +t.dataset.s || D.sec || 3 }; D.sec = instinct.R.sec; IS.set(D); inNext(); return; }
      if (a === 'call' && R && R.ph === 'call') { R.ans = t.dataset.v === 'abn'; R.right = R.ans === R.p.abnormal; if (R.right) R.ok++; L.fx(R.right); R.ph = 'show'; inDraw(); return; }
      if (a === 'next' && R) { R.i++; if (R.i >= R.n) { const D = IS.get({ best: 0, sec: 3 }); R.best = R.ok > (D.best || 0); D.best = Math.max(D.best || 0, R.ok); IS.set(D); R.ph = 'end'; if (R.ok >= 7) L.award('weak', 5); inDraw(); } else inNext(); return; }
      if (a === 'home') { clearTimeout(instinct.tm); instinct.R = null; inDraw(); }
    });
    inDraw();
  } };
  function inNext() { const R = instinct.R; R.p = makePanel(); R.ph = 'flash'; inDraw(); clearTimeout(instinct.tm); instinct.tm = setTimeout(() => { if (instinct.R === R && R.ph === 'flash' && instinct.el.isConnected) { R.ph = 'call'; inDraw(); } }, R.sec * 1000); }
  function panelHTML(p, show) { return `<div class="lr-tbl">${p.rows.map(r => `<div class="lr-row${show && r.flag ? ' r-bad' : ''}"><span class="lr-n">${esc(r.name)}${show ? `<small>${r.lo}–${r.hi} ${esc(r.unit)}</small>` : ''}</span><span class="lr-v">${esc(r.v)}<small>${esc(r.unit)}</small></span>${show ? `<span class="lr-tag ${r.flag ? r.flag.toLowerCase() : ''}">${r.flag === 'H' ? 'High' : r.flag === 'L' ? 'Low' : 'OK'}</span>` : ''}</div>`).join('')}</div>`; }
  function inDraw() {
    const el = instinct.el, R = instinct.R; if (!el || !el.isConnected) return; let h;
    if (!R) { const D = IS.get({ best: 0, sec: 3 }); h = head('Lab value instinct', 'A lab panel flashes up for a few seconds, no reference ranges. Call it: all normal, or something off? Trains the instant gut read you need on a busy ward.') + `<div class="lb-card"><p>Best: <b>${D.best || 0}/10</b></p></div><div class="lb-btns"><button type="button" class="btn pri" data-in="start" data-s="3">3 seconds</button><button type="button" class="btn" data-in="start" data-s="2">2 s (hard)</button><button type="button" class="btn" data-in="start" data-s="5">5 s</button></div>`; }
    else if (R.ph === 'end') h = head('Round done', '') + `<div class="lb-card ${R.ok >= 7 ? 'l20-good' : ''}"><h3>${R.ok}/${R.n}${R.best ? ' · new best!' : ''}</h3></div><div class="lb-btns"><button type="button" class="btn pri" data-in="start" data-s="${R.sec}">Again</button><button type="button" class="btn" data-in="home">Done</button></div>`;
    else {
      h = L.top('', `<span class="l20-chip">${R.i + 1}/${R.n} · ${R.ok} right</span>`, 'tools') + `<p class="muted small">${R.p.sex === 'M' ? 'Adult man' : 'Adult woman'}</p>`;
      if (R.ph === 'flash') h += `<div class="l20-flash">${panelHTML(R.p, false)}<div class="l20-fbar" style="animation-duration:${R.sec}s"></div></div>`;
      else if (R.ph === 'call') h += `<div class="lb-card l20-hidden"><p>Panel hidden. Normal, or not?</p></div><div class="lb-btns"><button type="button" class="btn pri" data-in="call" data-v="ok">All normal</button><button type="button" class="btn danger" data-in="call" data-v="abn">Something's off</button></div>`;
      else h += `<div class="lb-card ${R.right ? 'l20-good' : 'l20-badc'}"><h3>${R.right ? 'Good instinct' : 'Missed'}: ${R.p.abnormal ? R.p.rows.filter(r => r.flag).length + ' abnormal' : 'all normal'}</h3></div>` + panelHTML(R.p, true) + `<button type="button" class="btn pri lb-wide" data-in="next">${R.i + 1 >= R.n ? 'Finish' : 'Next panel'}</button>`;
    }
    el.innerHTML = `<div class="lb">${h}<p class="lb-foot">Adult reference ranges, the same ones the Lab panel reader uses. Real labs vary a little.</p></div>`;
  }

  /* ---------- 8. Pharmacology flight sim ---------- */
  // A simplified teaching model: drug CLASSES move the vitals with an onset and a wear-off. No real doses, not a clinical model.
  const VIT = [['hr', 'HR', '/min'], ['sbp', 'BP sys', 'mmHg'], ['rr', 'RR', '/min'], ['spo2', 'SpO₂', '%']];
  const SCN = [
    { id: 'opioid', title: 'Opioid overdose', story: 'Found drowsy at a party, pinpoint pupils, barely breathing.', v: { hr: 58, sbp: 100, rr: 5, spo2: 82 }, goal: { rr: [12, 22], spo2: [94, 100], hr: [50, 120] }, drift: { rr: -0.02, spo2: -0.03 },
      drugs: [{ k: 'nalox', n: 'Naloxone', c: 'opioid antagonist', e: { rr: 11, spo2: 6, hr: 22, sbp: 15 }, on: 4, off: 40 }, { k: 'o2', n: 'Oxygen', c: 'gas', e: { spo2: 10 }, on: 3, off: 600 }, { k: 'bvm', n: 'Bag-mask breaths', c: 'airway support', e: { spo2: 8, rr: 6 }, on: 1, off: 12 }, { k: 'morph', n: 'More morphine', c: 'opioid agonist', e: { rr: -4, spo2: -6, sbp: -8 }, on: 4, off: 60 }],
      tip: 'Naloxone works fast but wears off sooner than many opioids, so the patient can slip back: watch the RR and give more.' },
    { id: 'ana', title: 'Anaphylaxis', story: 'Ate a cookie with peanuts: swollen lips, wheeze, faint.', v: { hr: 136, sbp: 74, rr: 30, spo2: 89 }, goal: { sbp: [100, 160], spo2: [94, 100], hr: [50, 115] }, drift: { sbp: -0.06, spo2: -0.02, hr: 0.03 }, link: -0.8,
      drugs: [{ k: 'adr', n: 'IM adrenaline', c: 'alpha + beta agonist', e: { sbp: 24, spo2: 4, hr: -6, rr: -5 }, on: 4, off: 45, fix: 0.35 }, { k: 'flu', n: 'Fluid bolus', c: 'crystalloid', e: { sbp: 10, hr: -5 }, on: 3, off: 80 }, { k: 'o2', n: 'Oxygen', c: 'gas', e: { spo2: 7 }, on: 3, off: 600 }, { k: 'salb', n: 'Salbutamol neb', c: 'beta-2 agonist', e: { spo2: 3, rr: -3, hr: 10 }, on: 5, off: 40 }, { k: 'anti', n: 'Antihistamine', c: 'H1 blocker', e: { sbp: 1 }, on: 15, off: 120 }],
      tip: 'Adrenaline first, and repeat it if needed. Antihistamines help the itch, not the shock.' },
    { id: 'sepsis', title: 'Septic shock', story: 'Fever and confusion from a kidney infection, cold mottled legs.', v: { hr: 126, sbp: 78, rr: 26, spo2: 93 }, goal: { sbp: [100, 160], hr: [50, 110], spo2: [94, 100] }, drift: { sbp: -0.05, hr: 0.04, spo2: -0.01 }, link: -0.8,
      drugs: [{ k: 'flu', n: 'Fluid bolus', c: 'crystalloid', e: { sbp: 10, hr: -7 }, on: 3, off: 60 }, { k: 'nor', n: 'Noradrenaline', c: 'vasopressor (alpha agonist)', e: { sbp: 18, hr: 2 }, on: 3, off: 25 }, { k: 'abx', n: 'IV antibiotics', c: 'treat the source', e: { hr: -2 }, on: 20, off: 600, fix: 0.6 }, { k: 'o2', n: 'Oxygen', c: 'gas', e: { spo2: 5 }, on: 3, off: 600 }, { k: 'bb', n: 'Beta blocker', c: 'beta-1 antagonist', e: { hr: -20, sbp: -16 }, on: 4, off: 60 }],
      tip: 'Fluids and early antibiotics, then a vasopressor if the pressure won’t hold. Slowing the heart in shock drops the pressure further.' },
    { id: 'af', title: 'Fast atrial fibrillation', story: 'Palpitations for a day, heart racing irregularly, pressure OK.', v: { hr: 150, sbp: 108, rr: 20, spo2: 96 }, goal: { hr: [60, 110], sbp: [95, 160], spo2: [94, 100] }, drift: { hr: 0.02 },
      drugs: [{ k: 'bb', n: 'Beta blocker', c: 'beta-1 antagonist', e: { hr: -28, sbp: -6 }, on: 5, off: 90 }, { k: 'ccb', n: 'Rate-control CCB', c: 'non-DHP calcium channel blocker', e: { hr: -24, sbp: -9 }, on: 5, off: 90 }, { k: 'flu', n: 'Fluid bolus', c: 'crystalloid', e: { sbp: 8 }, on: 3, off: 40 }, { k: 'adr', n: 'Adrenaline', c: 'alpha + beta agonist', e: { hr: 25, sbp: 15 }, on: 3, off: 30 }],
      tip: 'Slow the rate gently and keep an eye on the pressure: stacking rate-control drugs can drop it.' }
  ];
  const FL = store('flight'), HOLD = 15, LIMIT = 180;
  const flight = { render(el) {
    el.__l20 = 'flight'; flight.el = el; flight.R = null; clearInterval(flight.tk);
    mount(el, 'flight', e => { const t = e.target.closest('[data-fl]'); if (!t) return; const a = t.dataset.fl, R = flight.R;
      if (a === 'go') { const s = SCN.find(x => x.id === t.dataset.id); flStart(s); return; }
      if (a === 'give' && R && !R.end) { const d = R.s.drugs.find(x => x.k === t.dataset.k); if (d) { R.doses.push({ d, t: R.t }); R.log.unshift(`${Math.floor(R.t)}s · ${d.n}`); if (d.fix) R.fix = Math.max(0, R.fix - d.fix); L.fx(true); flDraw(); } return; }
      if (a === 'stop' || a === 'home') { clearInterval(flight.tk); flight.R = null; flDraw(); }
    });
    flDraw();
  } };
  function flStart(s) {
    clearInterval(flight.tk);
    const R = flight.R = { s, t: 0, base: { ...s.v }, cur: { ...s.v }, dz: { hr: 0, sbp: 0, rr: 0, spo2: 0 }, fix: 1, doses: [], log: [], hold: 0, hist: [], end: null };
    flDraw();
    flight.tk = setInterval(() => {
      if (!flight.el || !flight.el.isConnected || flight.el.__l20 !== 'flight' || flight.R !== R || R.end) { clearInterval(flight.tk); return; }
      R.t += 0.5; for (const k in s.drift) R.dz[k] += s.drift[k] * R.fix * 0.25 * (k === 'spo2' ? 1 : Math.abs(s.v[k]) / 10);
      const v = {};
      for (const k of ['sbp', 'rr', 'hr', 'spo2']) { // pressure first: in shock the heart rate follows it (baroreflex)
        let x = R.base[k] + R.dz[k];
        for (const { d, t } of R.doses) { const dt = R.t - t, mag = (d.e || {})[k] || 0; if (!mag || dt < 0) continue; x += mag * (dt < d.on ? dt / d.on : Math.pow(0.5, (dt - d.on) / d.off)); }
        if (k === 'hr' && s.link) x += s.link * (v.sbp - R.base.sbp);
        if (k === 'spo2') { const rrDef = Math.max(0, 12 - (v.rr != null ? v.rr : R.base.rr)); x -= rrDef * 0.6; x = Math.min(100, x); }
        x += (Math.random() - 0.5) * (k === 'spo2' ? 0.6 : 1.4); v[k] = Math.max(0, x);
      }
      R.cur = v; R.hist.push({ ...v }); if (R.hist.length > 120) R.hist.shift();
      const inGoal = Object.entries(s.goal).every(([k, [lo, hi]]) => v[k] >= lo && v[k] <= hi);
      R.hold = inGoal ? R.hold + 0.5 : 0;
      if (R.hold >= HOLD) flEnd('win'); else if (v.sbp < 50 || v.spo2 < 70 || v.hr > 190 || v.hr < 30 || v.rr < 2) flEnd('crash'); else if (R.t >= LIMIT) flEnd('time');
      flPaint();
    }, 500);
  }
  function flEnd(why) { const R = flight.R; R.end = why; clearInterval(flight.tk); const D = FL.get({ wins: {} }); if (why === 'win') { const b = D.wins[R.s.id]; if (!b || R.t < b) D.wins[R.s.id] = Math.round(R.t); FL.set(D); L.award('sim', 10); } L.fx(why === 'win'); flDraw(); }
  const inRange = (R, k) => { const g = R.s.goal[k]; return !g ? null : R.cur[k] >= g[0] && R.cur[k] <= g[1]; };
  function flPaint() { // live numbers only (no full redraw every tick)
    const el = flight.el, R = flight.R; if (!el || !R) return;
    for (const [k] of VIT) { const n = el.querySelector(`[data-fv="${k}"]`); if (n) { n.textContent = Math.round(R.cur[k]); const ok = inRange(R, k); n.parentNode.classList.toggle('ok', ok === true); n.parentNode.classList.toggle('bad', ok === false); } }
    const hb = el.querySelector('[data-fl-hold]'); if (hb) hb.style.width = Math.round(R.hold / HOLD * 100) + '%';
    const tm = el.querySelector('[data-fl-t]'); if (tm) tm.textContent = Math.floor(R.t) + 's';
    const cv = el.querySelector('canvas'); if (cv && cv.getContext) { const g = cv.getContext('2d'), W = cv.width, H = cv.height, cs = getComputedStyle(el); g.clearRect(0, 0, W, H);
      const col = { hr: '#2fbf71', sbp: '#e5484d', rr: '#f5a524', spo2: '#3e8ef7' }, sc = { hr: [20, 200], sbp: [40, 200], rr: [0, 45], spo2: [60, 100] };
      for (const [k] of VIT) { g.strokeStyle = col[k]; g.lineWidth = 2; g.beginPath(); R.hist.forEach((p, i) => { const x = i / 119 * W, y = H - (p[k] - sc[k][0]) / (sc[k][1] - sc[k][0]) * H; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
      void cs; }
  }
  function flDraw() {
    const el = flight.el, R = flight.R; if (!el || !el.isConnected) return; let h;
    if (!R) { const D = FL.get({ wins: {} });
      h = head('Pharmacology flight sim', 'Pick a patient and treat them live. Each drug class nudges the vitals with its own onset and wear-off. Get every target into range and hold it for 15 seconds before the patient crashes.') +
        `<div class="lb-group">${SCN.map(s => `<button type="button" class="lb-row" data-fl="go" data-id="${s.id}"><span class="lb-rt"><span class="t1">${esc(s.title)}</span><span class="t2">${esc(s.story)}</span></span>${D.wins[s.id] ? `<span class="lb-best">${D.wins[s.id]}s</span>` : ''}<span class="lb-chev">${L.ic('chev', 16)}</span></button>`).join('')}</div>`; }
    else { const s = R.s;
      h = L.top('', `<span class="l20-chip" data-fl-t>${Math.floor(R.t)}s</span>`, 'tools') + `<h2 class="lb-title">${esc(s.title)}</h2><p class="muted lb-p">${esc(s.story)}</p>
        <div class="l20-mon">${VIT.map(([k, n, u]) => { const g = s.goal[k], ok = inRange(R, k); return `<div class="l20-vit ${ok === true ? 'ok' : ok === false ? 'bad' : ''}"><small>${n}</small><b data-fv="${k}">${Math.round(R.cur[k])}</b><em>${g ? `${g[0]}–${g[1]}` : u}</em></div>`; }).join('')}</div>
        <canvas width="360" height="110" class="l20-cv" aria-hidden="true"></canvas><div class="l20-hold"><i data-fl-hold style="width:${Math.round(R.hold / HOLD * 100)}%"></i><span>Hold all targets ${HOLD}s</span></div>`;
      if (R.end) h += `<div class="lb-card ${R.end === 'win' ? 'l20-good' : 'l20-badc'}"><h3>${R.end === 'win' ? `Stabilised in ${Math.round(R.t)}s` : R.end === 'crash' ? 'The patient crashed' : 'Out of time'}</h3><p class="small">${esc(s.tip)}</p></div><div class="lb-btns"><button type="button" class="btn pri" data-fl="go" data-id="${s.id}">Fly it again</button><button type="button" class="btn" data-fl="home">Other patients</button></div>`;
      else h += `<div class="l20-drugs">${s.drugs.map(d => `<button type="button" class="btn l20-drug" data-fl="give" data-k="${d.k}"><b>${esc(d.n)}</b><small>${esc(d.c)}</small></button>`).join('')}</div><button type="button" class="btn ghost lb-wide" data-fl="stop">Stop</button>`;
      if (R.log.length) h += `<div class="l20-k">Given</div><p class="small muted">${R.log.slice(0, 12).map(esc).join(' · ')}</p>`;
    }
    el.innerHTML = `<div class="lb">${h}<p class="lb-foot">A simplified teaching model of drug classes: no real doses, timings are sped up, and real patients don't behave this neatly. Not medical advice.</p></div>`;
    if (R) flPaint();
  }

  Object.assign(window.LabMods, { forg, teach, forge, ctag, neuron, cram, instinct, flight });
})();
