/* Synapse study tools (v176; since v178 they open from search and Deck options): hours · twins · report.
   Built only from your own cards and review history, on this phone. Anything that is a pattern (not a rule) says so on screen. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc; L.css2(); L.css3();
  if (!document.getElementById('l8css')) { const l = document.createElement('link'); l.id = 'l8css'; l.rel = 'stylesheet'; l.href = 'feat/lab/labs8.css?v=' + L.VER; document.head.appendChild(l); }
  const DAY9 = 864e5;
  const plain = h => String(h || '').replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '$1').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
  function qa(c) { const n = M.notes.get(c.nid); if (!n) return { q: '', a: '' }; if (n.type === 'cloze') return { q: plain(n.front), a: plain(n.back) }; return c.ord === 1 ? { q: plain(n.back), a: plain(n.front) } : { q: plain(n.front), a: plain(n.back) }; }
  const short = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
  const liveCards = f => { const out = []; for (const c of M.cards.values()) { if (c.del) continue; const d = M.decks.get(c.deck); if (!d || d.del) continue; if (f && !f(c)) continue; out.push(c); } return out; };
  const deckName = id => ((M.decks.get(id) || {}).name || 'Deck');
  const head = (t, p) => L.top(t, '', 'tools') + `<p class="muted lb-p">${p}</p>`;
  const empty = msg => `<div class="lb-empty">${msg}</div>`;
  const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '–';
  function mount(el, key, onClick, onChange) { if (el['__l9' + key]) return; el['__l9' + key] = 1; el.addEventListener('click', e => { if (el.__l9cur === key) onClick(e); }); if (onChange) el.addEventListener('change', e => { if (el.__l9cur === key) onChange(e); }); }
  function store(key) {
    const lk = 'l9.' + key, pid = 'lab:l9' + key;
    return {
      get(def) { let o = null; try { o = JSON.parse(localStorage.getItem(lk) || 'null'); } catch (e) {} try { const r = M.progress && M.progress.get(pid); if (r && r.data && (r.data.at || 0) > ((o && o.at) || 0)) { o = r.data; localStorage.setItem(lk, JSON.stringify(o)); } } catch (e) {} return o || def; },
      set(o) { o.at = Date.now(); try { localStorage.setItem(lk, JSON.stringify(o)); } catch (e) {} try { if (typeof write === 'function' && M.progress) write([['progress', { id: pid, t: 'lab', data: o, at: o.at, del: 0 }]]); } catch (e) {} }
    };
  }
  const bar = (v, best) => `<span class="l9-bar${best ? ' best' : ''}"><i style="width:${Math.max(2, Math.round(v * 100))}%"></i></span>`;

  /* ---------- 1. Best time to study ---------- */
  const SLOTS = [[5, 8, 'Early morning', '5–8 am'], [8, 12, 'Morning', '8 am–noon'], [12, 15, 'Afternoon', 'noon–3 pm'], [15, 18, 'After school', '3–6 pm'], [18, 21, 'Evening', '6–9 pm'], [21, 24, 'Late evening', '9 pm–midnight'], [0, 5, 'Night', 'midnight–5 am']];
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = { render(el) {
    el.__l9cur = 'hours';
    const since = Date.now() - 90 * DAY9, rv = [];
    for (const r of M.revlog.values()) if (!r.del && r.t >= since && r.g && (r.ps || 0) >= 1) rv.push(r); // reviews of cards you'd already learned (first looks at new cards would skew it)
    let h = head('Best time to study', 'When do you remember best? Every review you did of cards you already knew, over the last 90 days, grouped by time of day.');
    if (rv.length < 40) { el.innerHTML = `<div class="lb">${h}${empty(`Needs at least 40 reviews of cards you’ve already learned. You have ${rv.length} so far. Keep studying and check back.`)}<p class="lb-foot">Counts only reviews done on this account.</p></div>`; return; }
    const S = SLOTS.map(([a, b, n, t]) => { const xs = rv.filter(r => { const hr = new Date(r.t).getHours(); return hr >= a && hr < b; }); const ok = xs.filter(r => r.g > 1).length, tk = xs.map(r => r.took || 0).filter(x => x > 0).sort((x, y) => x - y); return { n, t, k: xs.length, ok, r: xs.length ? ok / xs.length : 0, med: tk.length ? tk[tk.length >> 1] : 0 }; });
    const all = rv.filter(r => r.g > 1).length / rv.length, ok15 = S.filter(s => s.k >= 15), best = ok15.length >= 2 ? ok15.reduce((a, b) => b.r > a.r ? b : a) : null;
    const W = WD.map((n, i) => { const xs = rv.filter(r => new Date(r.t).getDay() === i); return { n, k: xs.length, r: xs.length ? xs.filter(r => r.g > 1).length / xs.length : 0 }; });
    h += `<div class="l8-stats two"><div><b>${pct(rv.filter(r => r.g > 1).length, rv.length)}</b><span>remembered overall</span></div><div><b>${rv.length}</b><span>reviews counted</span></div></div>`;
    if (best && best.r - all >= 0.03) h += `<div class="lb-card"><p>You remember most in the <b>${esc(best.n.toLowerCase())}</b> (${esc(best.t)}): ${pct(best.ok, best.k)} vs ${Math.round(all * 100)}% overall. Try putting your hardest deck there.</p></div>`;
    else if (best) h += `<div class="lb-card"><p>No time of day clearly beats the others for you yet. That’s good news: study whenever fits.</p></div>`;
    h += `<div class="mx-h">By time of day</div><div class="lb-group">${S.map(s => `<div class="lb-row l9-r"><span class="lb-rt"><span class="t1">${esc(s.n)} <span class="muted small">${esc(s.t)}</span></span><span class="t2">${s.k ? `${pct(s.ok, s.k)} remembered · ${s.k} reviews${s.med ? ' · ' + (s.med / 1000).toFixed(1) + ' s per card' : ''}` : 'No reviews'}</span>${s.k ? bar(s.r, best === s) : ''}</span></div>`).join('')}</div>`;
    h += `<div class="mx-h">By day of the week</div><div class="l9-week">${W.map(w => `<div><span class="l9-col"><i style="height:${w.k ? Math.max(4, Math.round(w.r * 100)) : 0}%"></i></span><b>${w.k ? Math.round(w.r * 100) + '%' : '–'}</b><span>${w.n}</span></div>`).join('')}</div>`;
    h += `<p class="lb-foot">Your own reviews only. It’s a pattern, not a rule: if you always do your hardest deck at night, nights will look worse even if your brain is fine then. Times under 15 reviews aren’t picked as “best”.</p>`;
    el.innerHTML = `<div class="lb">${h}</div>`;
  } };

  /* ---------- 2. Card twins (near-duplicate finder) ---------- */
  const TW = store('twins');
  const STOP9 = new Set('the a an and or of to in on for with by is are was were be been it its this that these those as at from which who what when where how why not no but if then than into out does do did can will what which'.split(' '));
  const terms = s => [...new Set((s.toLowerCase().match(/[a-zäöüßéèàçñ0-9]+/g) || []).filter(w => w.length >= 3 && !STOP9.has(w)).map(w => w.length > 5 ? w.replace(/(ing|ed|es|s)$/, '') : w.replace(/s$/, '')))];
  function twinPairs() {
    const ign = new Set((TW.get({ ign: [] }).ign) || []);
    const cs = liveCards(c => !c.susp && c.ord !== 1).slice(0, 4000).map(c => { const x = qa(c); return { c, q: x.q, a: x.a, t: terms(x.q), at: terms(x.a), k: x.q.toLowerCase().replace(/[^a-z0-9]+/g, '') }; }).filter(o => o.q.length >= 6);
    const idx = new Map(), df = new Map(), out = [], seen = new Set();
    cs.forEach((o, i) => o.t.forEach(w => { (idx.get(w) || idx.set(w, []).get(w)).push(i); df.set(w, (df.get(w) || 0) + 1); }));
    cs.forEach((a, i) => {
      const cnt = new Map();
      a.t.forEach(w => { if (df.get(w) > 80) return; for (const j of idx.get(w)) if (j > i) cnt.set(j, (cnt.get(j) || 0) + 1); });
      for (const [j, n] of cnt) {
        const b = cs[j]; if (a.c.nid === b.c.nid) continue;
        const exact = a.k && a.k === b.k, jac = n / (a.t.length + b.t.length - n);
        if (!exact && (n < 3 || jac < 0.7)) continue; if (!exact && a.at.length >= 2 && b.at.length >= 2) { const sa = new Set(a.at), both = b.at.filter(w => sa.has(w)).length; if (both / (a.at.length + b.at.length - both) < 0.25) continue; } // same-looking question, clearly different answers ("5 H's" vs "5 T's"): not twins
        const key = [a.c.id, b.c.id].sort().join('|'); if (seen.has(key) || ign.has(key)) continue; seen.add(key);
        out.push({ a, b, key, sc: exact ? 2 : jac });
      }
    });
    return out.sort((x, y) => y.sc - x.sc).slice(0, 40);
  }
  const twins = { render(el) {
    el.__l9cur = 'twins'; twins.el = el;
    mount(el, 'twins', async e => {
      const t = e.target.closest('[data-tw]'); if (!t) return; const a = t.dataset.tw;
      if (a === 'sus' || a === 'uns') { const c = M.cards.get(t.dataset.id); if (!c) return; const D = TW.get({ ign: [] }); D.sus = (D.sus || []).filter(x => x !== c.id); if (a === 'sus') D.sus.push(c.id); TW.set(D); const n = { ...c }; if (a === 'sus') n.susp = 1; else delete n.susp; await write([['cards', n]]); toast(a === 'sus' ? 'Suspended. You can bring it back at the bottom of this page.' : 'Back in your reviews'); drawT(); return; }
      if (a === 'ign') { const D = TW.get({ ign: [] }); D.ign = (D.ign || []).concat(t.dataset.k).slice(-500); TW.set(D); drawT(); }
    });
    drawT();
  } };
  function drawT() {
    const el = twins.el, P = twinPairs();
    const side = (o, lbl) => `<div class="l9-tw"><p class="small muted">${lbl} · ${esc(deckName(o.c.deck))}${o.c.lapses ? ' · forgot ' + o.c.lapses + '×' : ''}</p><p><b>${esc(short(o.q, 160))}</b></p><p class="small">${esc(short(o.a, 160))}</p><button type="button" class="btn" data-tw="sus" data-id="${esc(o.c.id)}">Suspend this one</button></div>`;
    el.innerHTML = `<div class="lb">${head('Card twins', 'Finds cards that ask nearly the same question, often in different decks. Twins split your reviews in two; keep the better one and suspend the other.')}
      ${P.length ? `<div class="mx-h">${P.length} possible twin${P.length === 1 ? '' : 's'}</div>` + P.map(p => `<div class="lb-card">${p.sc >= 2 ? '<p class="small"><b>Same question, word for word</b></p>' : ''}${side(p.a, 'A')}${side(p.b, 'B')}<button type="button" class="btn lb-wide" data-tw="ign" data-k="${esc(p.key)}">Not twins, hide this pair</button></div>`).join('') : empty('No twins found. Every card asks its own question. 👍')}
      ${(() => { const su = ((TW.get({}).sus) || []).map(id => M.cards.get(id)).filter(c => c && !c.del && c.susp); return su.length ? `<div class="mx-h">Suspended here</div><div class="lb-group">${su.map(c => `<div class="lb-row"><span class="lb-rt"><span class="t1">${esc(short(qa(c).q, 80))}</span><span class="t2">${esc(deckName(c.deck))}</span></span><button type="button" class="btn" data-tw="uns" data-id="${esc(c.id)}">Bring back</button></div>`).join('')}</div>` : ''; })()}
      <p class="lb-foot">Matching is by shared words in the question (70%+ of key words) and, when the answers are long enough, some overlap in the answers too. It’s a guess: two cards about the same drug can share words and still test different things. Suspending only pauses a card (nothing is deleted) and “Bring back” undoes it. Checks up to 4,000 cards.</p></div>`;
  }

  /* ---------- 3. Deck report card ---------- */
  const RP = store('report');
  const report = { render(el) {
    el.__l9cur = 'report'; report.el = el;
    mount(el, 'report', async e => {
      const t = e.target.closest('[data-rp]'); if (!t) return;
      if (t.dataset.rp === 'copy') { const txt = el.querySelector('[data-rp-txt]'); try { await navigator.clipboard.writeText(txt ? txt.value : ''); toast('Copied'); } catch (err) { toast('Couldn’t copy on this phone'); } }
    }, e => { if (e.target.matches('[data-rp-deck]')) { RP.set({ deck: e.target.value }); drawR(); } });
    drawR();
  } };
  function drawR() {
    const el = report.el, ds = live(M.decks).sort((a, b) => a.name.localeCompare(b.name));
    let cur = window.__deckTool || (RP.get({}).deck) || ''; if (window.__deckTool) { RP.set({ deck: cur }); window.__deckTool = null; } // v178: opened from a deck's options if (cur !== '*' && !M.decks.get(cur)) cur = '*';
    const sel = `<select data-rp-deck><option value="*"${cur === '*' ? ' selected' : ''}>All decks</option>${ds.map(d => `<option value="${esc(d.id)}"${cur === d.id ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select>`;
    const cs = liveCards(c => cur === '*' || c.deck === cur), ids = new Set(cs.map(c => c.id)), now = Date.now();
    let h = head('Deck report card', 'One screen that says how a deck is really going: what you know, what keeps slipping, and how much you’ve studied it lately.') + `<div class="l8-row">${sel}</div>`;
    if (!cs.length) { el.innerHTML = `<div class="lb">${h}${empty('No cards in this deck yet.')}</div>`; return; }
    const nw = cs.filter(c => !c.st).length, sus = cs.filter(c => c.susp).length, mat = cs.filter(c => c.st === 2 && (c.s || 0) >= 21).length, lrn = cs.length - nw;
    const rv30 = [], rv7 = []; for (const r of M.revlog.values()) if (!r.del && ids.has(r.cid) && r.t >= now - 30 * DAY9) { rv30.push(r); if (r.t >= now - 7 * DAY9) rv7.push(r); }
    const old = rv30.filter(r => (r.ps || 0) >= 1), keep = old.filter(r => r.g > 1).length;
    const days = new Set(rv30.map(r => new Date(r.t).toDateString())).size;
    const due = cs.filter(c => !c.susp && c.st && c.due && c.due <= now + DAY9).length;
    const worst = cs.filter(c => (c.lapses || 0) > 0 && !c.susp).sort((a, b) => (b.lapses || 0) - (a.lapses || 0)).slice(0, 5);
    const grade = old.length < 20 ? null : keep / old.length >= 0.9 ? 'A' : keep / old.length >= 0.8 ? 'B' : keep / old.length >= 0.7 ? 'C' : 'D';
    h += `<div class="l8-stats"><div><b>${grade || '–'}</b><span>grade${grade ? '' : ' (needs 20 reviews)'}</span></div><div><b>${pct(keep, old.length)}</b><span>remembered, 30 days</span></div><div><b>${days}</b><span>days studied, 30</span></div></div>`;
    h += `<div class="mx-h">Cards</div><div class="lb-group"><div class="lb-row"><span class="lb-rt"><span class="t1">${cs.length} cards</span><span class="t2">${lrn} started · ${mat} solid (3+ weeks memory) · ${nw} not seen yet${sus ? ' · ' + sus + ' suspended' : ''}</span>${bar(cs.length ? mat / cs.length : 0, true)}</span></div>
      <div class="lb-row"><span class="lb-rt"><span class="t1">${rv30.length} reviews in 30 days</span><span class="t2">${rv7.length} this week · ${due} due by tomorrow</span></span></div></div>`;
    if (worst.length) h += `<div class="mx-h">Keeps slipping</div><div class="lb-group">${worst.map(c => `<div class="lb-row"><span class="lb-rt"><span class="t1">${esc(short(qa(c).q, 90))}</span><span class="t2">forgot ${c.lapses}× · ${esc(deckName(c.deck))}</span></span></div>`).join('')}</div><p class="small muted">Tip: search for Card autopsy or Leech splitter: they work on exactly these.</p>`;
    const name = cur === '*' ? 'All decks' : deckName(cur);
    const txt = `Synapse report: ${name}\nGrade: ${grade || 'not enough reviews yet'}\nRemembered (30 days): ${pct(keep, old.length)} of ${old.length} reviews\nCards: ${cs.length} (${mat} solid, ${nw} not seen yet)\nStudied ${days} of the last 30 days, ${rv7.length} reviews this week\n` + (worst.length ? 'Keeps slipping:\n' + worst.map(c => '- ' + short(qa(c).q, 80) + ' (forgot ' + c.lapses + 'x)').join('\n') : '');
    h += `<textarea class="l8-ta" data-rp-txt rows="6" readonly aria-label="Report text">${esc(txt)}</textarea><button type="button" class="btn pri lb-wide" data-rp="copy">Copy report</button>`;
    h += `<p class="lb-foot">Grade from how often you remembered cards you’d already learned in the last 30 days: A 90%+, B 80%+, C 70%+, D below. “Solid” means Synapse expects you to remember it 3+ weeks out.</p>`;
    el.innerHTML = `<div class="lb">${h}</div>`;
  }

  Object.assign(window.LabMods, { hours, twins, report });
})();
