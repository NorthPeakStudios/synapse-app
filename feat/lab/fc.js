/* 30-day review forecast (#35): how many reviews are coming each day for the next 30 days (overdue folded into today), per deck or all decks, with a running total line, busiest day and daily average. Tap a bar for that day's deck breakdown. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc; L.css2(); L.css3();
  let S = null;
  function render(el) { S = { el, deck: localStorage.getItem('fc.deck') || '*', pick: 0 }; if (!el.__fc) { el.__fc = 1; el.addEventListener('click', onClick); el.addEventListener('change', onChange); } paint(); }
  function data() {
    const now = Date.now(), ds0 = dayStart(now), days = Array.from({ length: 30 }, () => ({ n: 0, by: {} }));
    let overdue = 0, fresh = 0;
    const cards = live(M.cards).filter(c => { const d = M.decks.get(c.deck); return d && !d.del && (S.deck === '*' || c.deck === S.deck); });
    for (const c of cards) {
      if (c.st === 0) { fresh++; continue; }
      if (c.susp) continue;
      const k0 = Math.floor((dayStart(c.due) - ds0) / DAY + 0.5); if (k0 < 0) overdue++; const k = Math.max(0, k0); if (k >= 30) continue;
      days[k].n++; days[k].by[c.deck] = (days[k].by[c.deck] || 0) + 1;
    }
    return { days, overdue, fresh, ds0, total: cards.length };
  }
  function chart(d) {
    const W = 340, H = 170, pad = 22, bw = (W - pad) / 30, mx = Math.max(1, ...d.days.map(x => x.n)); let cum = 0; const tot = d.days.reduce((s, x) => s + x.n, 0) || 1; const pts = [];
    let bars = '';
    d.days.forEach((x, i) => { const h = Math.round(x.n / mx * (H - 34)); const xx = pad + i * bw; bars += `<rect x="${(xx + 1).toFixed(1)}" y="${H - 18 - h}" width="${(bw - 2).toFixed(1)}" height="${Math.max(h, x.n ? 2 : 0)}" rx="2" fill="${i === S.pick ? 'var(--acc,#0a84ff)' : i === 0 ? '#ff9f0a' : 'rgba(10,132,255,.55)'}" data-fc-d="${i}"/><rect x="${xx}" y="0" width="${bw}" height="${H}" fill="transparent" data-fc-d="${i}"/>`; cum += x.n; pts.push(`${(xx + bw / 2).toFixed(1)},${(H - 18 - cum / tot * (H - 34)).toFixed(1)}`); });
    const lab = i => { const dd = new Date(d.ds0 + i * DAY + 12 * HOUR); return (dd.getMonth() + 1) + '/' + dd.getDate(); };
    const ticks = [0, 7, 14, 21, 29].map(i => `<text x="${(pad + i * bw + bw / 2).toFixed(1)}" y="${H - 4}" font-size="9" text-anchor="middle" fill="currentColor" opacity=".6">${i === 0 ? 'Today' : lab(i)}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;color:inherit" role="img" aria-label="Reviews due per day for 30 days"><line x1="${pad}" y1="${H - 18}" x2="${W}" y2="${H - 18}" stroke="currentColor" opacity=".2"/><text x="2" y="12" font-size="9" fill="currentColor" opacity=".6">${mx}</text>${bars}<polyline points="${pts.join(' ')}" fill="none" stroke="#30d158" stroke-width="1.8" opacity=".9"/>${ticks}</svg><div class="muted small" style="display:flex;gap:12px;margin-top:4px"><span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:rgba(10,132,255,.55)"></span> reviews that day</span><span><span style="display:inline-block;width:12px;height:2px;background:#30d158;vertical-align:middle"></span> running total</span></div>`;
  }
  function paint() {
    if (!S || !S.el.isConnected) return; const d = data(), n = d.days.map(x => x.n), sum = (a, b) => n.slice(a, b).reduce((s, v) => s + v, 0);
    const busy = n.indexOf(Math.max(...n)), dl = i => new Date(d.ds0 + i * DAY + 12 * HOUR).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const decks = live(M.decks).filter(x => !x.del).sort((a, b) => a.name.localeCompare(b.name));
    let h = L.top('30-day forecast', '', 'tools');
    h += `<label class="muted small" style="display:block;margin:6px 0 4px">Deck</label><select data-fc-deck style="width:100%;font-size:16px;padding:10px;border-radius:12px;background:var(--card,#1c1c1e);color:inherit;border:1px solid rgba(127,127,127,.35)"><option value="*">All decks</option>${decks.map(x => `<option value="${esc(x.id)}" ${S.deck === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`;
    h += `<div class="tiles" style="margin-top:12px"><div class="tile"><div class="v">${n[0]}</div><div class="k">Today${d.overdue ? ' · incl. ' + d.overdue + ' overdue' : ''}</div></div><div class="tile"><div class="v">${sum(0, 7)}</div><div class="k">Next 7 days</div></div><div class="tile"><div class="v">${sum(0, 30)}</div><div class="k">Next 30 days</div></div><div class="tile"><div class="v">${Math.round(sum(0, 30) / 30)}</div><div class="k">Average a day</div></div></div>`;
    h += `<div class="lb-card" style="margin-top:12px">${chart(d)}</div>`;
    const p = d.days[S.pick], by = Object.entries(p.by).sort((a, b) => b[1] - a[1]);
    h += `<div class="lb-card"><p style="margin:0 0 6px"><b>${S.pick === 0 ? 'Today' : dl(S.pick)}</b> · ${p.n} review${p.n === 1 ? '' : 's'}</p>${by.length ? by.slice(0, 8).map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:4px 0"><span>${esc((M.decks.get(k) || {}).name || 'Deck')}</span><span class="muted">${v}</span></div>`).join('') : '<p class="muted small" style="margin:0">Nothing due. Tap another bar.</p>'}</div>`;
    h += `<p class="muted small">Busiest day: <b>${n[busy] ? dl(busy) : '—'}</b>${n[busy] ? ' (' + n[busy] + ')' : ''}. ${d.fresh} new card${d.fresh === 1 ? '' : 's'} not started yet${d.fresh ? ' (they add to this as you learn them)' : ''}. Forecast assumes you review what's due each day.</p>`;
    S.el.innerHTML = `<div class="lb fc">${h}</div>`;
  }
  function onChange(e) { if (e.target.matches('[data-fc-deck]')) { S.deck = e.target.value; localStorage.setItem('fc.deck', S.deck); paint(); } }
  function onClick(e) { const b = e.target.closest('[data-fc-d]'); if (b && S) { S.pick = +b.getAttribute('data-fc-d'); paint(); } }
  window.LabMods.fc = { render, _S: () => S };
})();
