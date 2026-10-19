/* Memory hooks: mnemonic suggestions for cards you keep missing (missed 2+ times). Built from a hand-written library of classic clean mnemonics, acronym builder, word-part breakdown (medical word builder data) and drug stems. Your own hook can be saved per card (synced). */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  let D = null, W = null, S = null;
  const KEY = 'mnemo.v1';
  let MY = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } })();
  function saveMy() { MY.at = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(MY)); } catch (e) {} try { if (typeof write === 'function' && M.progress) write([['progress', { id: 'lab:mnemo', t: 'lab', data: MY, at: MY.at, del: 0 }]]); } catch (e) {} }
  function pullMy() { try { const o = M.progress && M.progress.get('lab:mnemo'); if (o && o.data && (o.data.at || 0) > (MY.at || 0)) { MY = o.data; localStorage.setItem(KEY, JSON.stringify(MY)); } } catch (e) {} }
  const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const plain = h => String(h || '').replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '$1').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const ready = () => Promise.all([D ? D : L.json('feat/lab/mnemo.json').then(d => (D = d)), W ? W : L.json('feat/lab/words.json').then(d => (W = d)).catch(() => (W = { parts: {} }))]);
  function qa(card) {
    const note = M.notes.get(card.nid); if (!note) return null;
    if (note.type === 'cloze') { const a = ((new RegExp('\\{\\{c' + card.ord + '::([\\s\\S]*?)(?:::|\\}\\})').exec(note.front) || [])[1] || ''); return { q: plain(note.front.replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, (m, x) => x === a ? '[…]' : x)), a: plain(a), tags: note.tags || [] }; }
    return card.ord === 1 ? { q: plain(note.back), a: plain(note.front), tags: note.tags || [] } : { q: plain(note.front), a: plain(note.back), tags: note.tags || [] };
  }
  function suggest(c) {
    const out = [], hay = ' ' + fold(c.q + ' ' + c.a).replace(/[^a-z0-9äöüß+-]+/g, ' ') + ' ';
    // 1 library
    for (const e of D.lib) { let n = 0; for (const k of e.k) { const kk = ' ' + fold(k).replace(/[^a-z0-9äöüß+-]+/g, ' ').trim(); if (kk.trim().startsWith('-') ? new RegExp('[a-z]' + kk.trim().slice(1) + '\\b').test(hay) : hay.includes(kk + ' ')) n++; } if (n >= (e.min || 1)) out.push({ s: 10 + n, kind: 'Classic mnemonic', t: e.m, e: e.e }); }
    // 2 acronym for lists
    const items = c.a.split(/\s*(?:,|;|\n|\band\b|\bund\b|\bet\b|\by\b)\s*/i).map(x => x.replace(/^(the|a|an)\s+/i, '').trim()).filter(x => x && x.length < 40);
    if (items.length >= 3 && items.length <= 9) {
      const letters = items.map(x => x[0].toUpperCase()); const ok = letters.every(l => /[A-ZÄÖÜ]/.test(l));
      if (ok) { const i0 = l => Math.max(0, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(l.replace('Ä', 'A').replace('Ö', 'O').replace('Ü', 'U')));
        const sent = letters.map((l, i) => i === letters.length - 1 ? D.nouns[i0(l)] : D.words[i0(l)]).join(' ');
        out.push({ s: 8, kind: 'First-letter hook', t: letters.join(' · ') + ': “' + sent + '”', e: items.map((x, i) => letters[i] + ' = ' + x).join(', ') }); }
    }
    // 3 word parts
    const parts = Object.entries(W.parts || {}).map(([k, v]) => [k.replace(/-/g, '').split('/')[0], k, v[1]]).filter(x => x[0].length >= 3).sort((a, b) => b[0].length - a[0].length);
    const words = [...new Set((c.q + ' ' + c.a).toLowerCase().match(/[a-z]{7,}/g) || [])].slice(0, 6);
    for (const w of words) { const got = []; let rest = w; for (let guard = 0; guard < 4 && rest.length >= 3; guard++) { const p = parts.find(x => rest.startsWith(x[0])); if (!p) break; got.push(p); rest = rest.slice(p[0].length).replace(/^o/, ''); }
      const suf = parts.find(x => w.endsWith(x[0]) && !got.includes(x)); if (suf && w.length - suf[0].length > 2) got.push(suf);
      if (got.length >= 2) out.push({ s: 7, kind: 'Break the word', t: w + ' = ' + got.map(x => x[0] + ' (' + x[2] + ')').join(' + '), e: 'Medical words are built from parts. Learn the parts and you can decode words you\'ve never seen.' }); }
    if (!out.length) out.push({ s: 1, kind: 'Make it weird', t: `Picture “${c.a.slice(0, 60)}” in a ridiculous scene with the question's key word, the sillier the better.`, e: 'No ready-made hook matched this card. Write your own below; a hook you make yourself sticks best.' });
    return out.sort((a, b) => b.s - a.s).slice(0, 3);
  }
  function hookHTML(card, c) {
    const sg = suggest(c), mine = MY[card.nid] || '';
    return `${sg.map(x => `<div class="mn-h"><div class="mn-k">${esc(x.kind)}</div><b>${esc(x.t)}</b>${x.e ? `<span>${esc(x.e)}</span>` : ''}</div>`).join('')}
      <form class="xp-f" data-mn-form="${esc(card.nid)}" autocomplete="off"><input type="text" data-mn-in value="${esc(mine)}" placeholder="Your own hook…" maxlength="200"><button class="btn" type="submit">Save</button></form>`;
  }
  function open(card) {
    ready().then(() => { pullMy(); const c = qa(card); if (!c) return; openSheet(`<div class="xp mn"><h2>💡 Memory hook</h2><div class="xp-card"><div class="xp-q">${esc(c.q)}</div><div class="xp-a">${esc(c.a)}</div></div><p class="muted small">You've missed this card ${card.lapses || 0} times. Try one of these:</p>${hookHTML(card, c)}<div class="actions"><button class="btn pri" data-close type="button">Got it</button></div></div>`); })
      .catch(() => toast('Couldn\'t load. Check your connection.'));
  }
  document.addEventListener('submit', e => { const f = e.target.closest('[data-mn-form]'); if (!f) return; e.preventDefault(); const v = f.querySelector('[data-mn-in]').value.trim(); if (v) MY[f.dataset.mnForm] = v; else delete MY[f.dataset.mnForm]; saveMy(); try { toast('Hook saved'); } catch (x) {} });
  function hard() { const out = []; for (const c of M.cards.values()) if (!c.del && (c.lapses || 0) >= 2 && M.notes.get(c.nid) && !M.notes.get(c.nid).del) out.push(c); return out.sort((a, b) => (b.lapses || 0) - (a.lapses || 0)).slice(0, 40); }
  function render(el) {
    S = { el, open: null };
    if (!el.__mn) { el.__mn = 1; el.addEventListener('click', e => { const r = e.target.closest('[data-mn-c]'); if (r) { S.open = S.open === r.dataset.mnC ? null : r.dataset.mnC; paint(); } }); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    ready().then(() => { pullMy(); paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  function paint() {
    if (!S || !S.el.isConnected) return; const H = hard();
    let h = L.top('Memory hooks', H.length ? H.length + ' hard cards' : '', 'tools') + `<p class="muted lb-p">Cards you've missed twice or more get mnemonic suggestions here (and a 💡 button when they come up in review). Save your own hook too.</p>`;
    if (!H.length) h += '<div class="lb-empty">No hard cards yet. Miss a card twice and it shows up here with hooks.</div>';
    else h += `<div class="mn-list">${H.map(card => { const c = qa(card); if (!c) return ''; const op = S.open === card.id; return `<div class="mn-it${op ? ' on' : ''}"><button type="button" class="mn-row" data-mn-c="${esc(card.id)}"><span class="mn-q">${esc(c.q.slice(0, 120))}</span><span class="mn-n">missed ${card.lapses}×</span></button>${op ? `<div class="mn-body"><div class="xp-a">${esc(c.a)}</div>${hookHTML(card, c)}</div>` : ''}</div>`; }).join('')}</div>`;
    S.el.innerHTML = `<div class="lb">${h}</div>`;
  }
  window.LabMods.mnemo = { render, open, suggest, _q: qa };
})();
