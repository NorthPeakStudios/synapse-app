/* Exam-day recall (v173): pick a date (defaults to your next planned exam) and see how much of each deck the FSRS-5 memory
   model expects you to still remember on that day if you stopped studying now, a 60-day forgetting curve, and the cards
   that will have faded most (one tap sends them to Weak Spots). Uses retr(t, stability) from the scheduler. Estimates only. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc; L.css2(); L.css3();
  let S = null;
  const pad2 = n => String(n).padStart(2, '0'), keyOf = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const plain = h => String(h || '').replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '$1').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  function nextExam() { try { const st = L.plan && L.plan.get ? L.plan.get() : null; const t = keyOf(new Date()); const ex = (st && st.exams || []).filter(x => x.date && x.date > t).sort((a, b) => a.date < b.date ? -1 : 1)[0]; return ex || null; } catch (e) { return null; } }
  function rev() { const out = []; for (const c of M.cards.values()) { if (c.del || c.susp || !(c.st === 2 || c.st === 3) || !c.s || !c.last) continue; const d = M.decks.get(c.deck); if (!d || d.del) continue; if (S.deck !== '*' && c.deck !== S.deck) continue; out.push(c); } return out; }
  const Rat = (c, when) => retr(Math.max(0, (dayStart(when) - dayStart(c.last)) / DAY), c.s);
  function render(el) {
    const ex = nextExam(); const def = ex ? ex.date : keyOf(new Date(Date.now() + 14 * DAY));
    S = { el, date: def, ex, deck: localStorage.getItem('rc.deck') || '*' };
    if (S.deck !== '*' && !(M.decks.get(S.deck) && !M.decks.get(S.deck).del)) S.deck = '*';
    if (!el.__rc) { el.__rc = 1; el.addEventListener('click', onClick); el.addEventListener('change', onChange); }
    paint();
  }
  function curve(cs) {
    const W = 340, H = 150, pl = 26, now = Date.now(), N = 61, pts = [];
    const tgt = new Date(S.date + 'T12:00:00').getTime(), ti = Math.round((dayStart(tgt) - dayStart(now)) / DAY);
    for (let i = 0; i < N; i++) { const w = now + i * DAY; let s = 0; for (const c of cs) s += Rat(c, w); pts.push(cs.length ? s / cs.length : 0); }
    const x = i => pl + i * (W - pl - 4) / (N - 1), y = p => 8 + (1 - p) * (H - 30);
    const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
    const grid = [1, 0.9, 0.75, 0.5].map(p => `<line x1="${pl}" x2="${W}" y1="${y(p)}" y2="${y(p)}" stroke="currentColor" opacity=".12"/><text x="0" y="${y(p) + 3}" font-size="9" fill="currentColor" opacity=".6">${p * 100}%</text>`).join('');
    const mk = ti >= 0 && ti < N ? `<line x1="${x(ti)}" x2="${x(ti)}" y1="6" y2="${H - 22}" stroke="#ff9f0a" stroke-width="1.6" stroke-dasharray="3 3"/><circle cx="${x(ti)}" cy="${y(pts[ti])}" r="4" fill="#ff9f0a"/>` : '';
    const ticks = [0, 15, 30, 45, 60].map(i => `<text x="${x(i)}" y="${H - 6}" font-size="9" text-anchor="${i === 60 ? 'end' : i === 0 ? 'start' : 'middle'}" fill="currentColor" opacity=".6">${i === 0 ? 'Today' : '+' + i + 'd'}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block" role="img" aria-label="Expected recall over the next 60 days with no more study">${grid}<line x1="${pl}" x2="${W}" y1="${y(0.9)}" y2="${y(0.9)}" stroke="#30d158" stroke-width="1.4" stroke-dasharray="5 4" opacity=".8"/><polyline points="${line}" fill="none" stroke="var(--acc,#0a84ff)" stroke-width="2.2"/>${mk}${ticks}</svg>
      <div class="muted small rc-lg"><span><i style="background:var(--acc,#0a84ff)"></i> if you stop studying now</span><span><i class="dash"></i> 90%: what your reviews aim for if you keep up</span></div>`;
  }
  const pct = p => Math.round(p * 100) + '%';
  function paint() {
    if (!S || !S.el.isConnected) return; const cs = rev(), tgt = new Date(S.date + 'T12:00:00').getTime(), now = Date.now();
    const days = Math.round((dayStart(tgt) - dayStart(now)) / DAY), ds = live(M.decks).sort((a, b) => a.name.localeCompare(b.name));
    let h = L.top('Exam-day recall', '', 'tools') + `<p class="muted lb-p">How much would you still remember on test day if you stopped studying right now? Pick a date.</p>`;
    h += `<div class="rc-ctl"><label class="rc-f">Date<input type="date" data-rc-date value="${esc(S.date)}" min="${keyOf(new Date())}"></label><label class="rc-f">Deck<select data-rc-deck><option value="*">All decks</option>${ds.map(d => `<option value="${esc(d.id)}"${S.deck === d.id ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label></div>`;
    if (S.ex && S.ex.date === S.date) h += `<div class="muted small rc-ex">📅 Your planned exam: <b>${esc(S.ex.name || 'Exam')}</b></div>`;
    if (!cs.length) { S.el.innerHTML = `<div class="lb rc">${h}<div class="lb-empty">No reviewed cards ${S.deck === '*' ? 'yet' : 'in this deck yet'}. Study a few and come back. New cards aren't counted because there's no memory to measure yet.</div></div>`; return; }
    let sNow = 0, sT = 0; const fade = []; for (const c of cs) { const a = Rat(c, now), b = Rat(c, tgt); sNow += a; sT += b; fade.push({ c, a, b }); }
    const pN = sNow / cs.length, pT = sT / cs.length, lost = Math.round(cs.length * (pN - pT));
    const label = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days';
    h += `<div class="lb-card rc-hero"><div class="rc-big">${pct(pT)}</div><p>expected recall ${label} (${new Date(tgt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}) if you stop now, across ${cs.length} reviewed card${cs.length === 1 ? '' : 's'}. Today it's ${pct(pN)}${lost > 0 ? `, so about <b>${lost}</b> card${lost === 1 ? '' : 's'}' worth would fade` : ''}.</p></div>`;
    h += `<div class="lb-card">${curve(cs)}</div>`;
    if (S.deck === '*' && ds.length > 1) {
      const by = {}; for (const f of fade) { const k = f.c.deck; (by[k] || (by[k] = { n: 0, a: 0, b: 0 })); by[k].n++; by[k].a += f.a; by[k].b += f.b; }
      const rows = Object.entries(by).map(([k, v]) => ({ name: (M.decks.get(k) || {}).name || 'Deck', ...v })).sort((x, y) => x.b / x.n - y.b / y.n);
      h += `<div class="mx-h">By deck · today → that day</div><div class="lb-group">${rows.map(r => `<div class="lb-row rc-row"><span class="lb-rt"><span class="t1">${esc(r.name)}</span><span class="t2">${r.n} reviewed</span></span><span class="rc-v">${pct(r.a / r.n)} → <b>${pct(r.b / r.n)}</b></span></div>`).join('')}</div>`;
    }
    fade.sort((x, y) => x.b - y.b); const worst = fade.filter(f => f.b < 0.8).slice(0, 10); S.worst = worst.map(f => f.c.id);
    if (worst.length) h += `<div class="mx-h">Most faded by then</div><div class="lb-group">${worst.map(f => { const n = M.notes.get(f.c.nid); return `<div class="lb-row rc-row"><span class="lb-rt"><span class="t1">${esc(plain(n ? (f.c.ord === 1 ? n.back : n.front) : '').slice(0, 80))}</span></span><span class="rc-v"><b>${pct(f.b)}</b></span></div>`; }).join('')}</div>${window.Weak && Weak.addCard ? `<button type="button" class="btn pri lb-wide" data-rc-weak>Send these ${worst.length} to Weak Spots</button>` : ''}`;
    h += `<p class="lb-foot">These are estimates from FSRS-5, the memory model Synapse uses to schedule your reviews. It predicts the chance you'd recall each card from how long since you last saw it and how well you knew it then. It's an average, not a promise, and studying before the test changes it (that's the point).</p>`;
    S.el.innerHTML = `<div class="lb rc">${h}</div>`;
  }
  function onChange(e) {
    if (e.target.matches('[data-rc-date]') && e.target.value) { S.date = e.target.value; paint(); }
    if (e.target.matches('[data-rc-deck]')) { S.deck = e.target.value; try { localStorage.setItem('rc.deck', S.deck); } catch (x) {} paint(); }
  }
  async function onClick(e) {
    const t = e.target.closest('[data-rc-weak]'); if (!t || !S || !S.worst) return; t.disabled = true;
    let n = 0; for (const id of S.worst) { const c = M.cards.get(id); if (c) { try { await Weak.addCard(c); n++; } catch (x) {} } }
    toast(n + ' card' + (n === 1 ? '' : 's') + ' → Weak Spots'); t.textContent = 'Sent to Weak Spots ✓';
  }
  window.LabMods.recall = { render };
})();
