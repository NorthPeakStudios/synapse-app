/* Share a deck by link (#40): pick a deck, get a read-only link. The page it opens shows ONLY that deck's cards: no name, no progress, nothing personal. Images are left out. Turn any link off at any time. Needs sync on (the link is tied to the sync account so only its owner can turn it off). */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc; L.css2(); L.css3();
  let S = null;
  const base = () => (window.ODIN_SITE || location.origin) + '/share/?t=';
  function render(el) { S = { el, mine: null, made: null, busy: 0, err: '' }; if (!el.__sh) { el.__sh = 1; el.addEventListener('click', onClick); } paint(); refresh(); }
  async function refresh() { if (!meta.code) return; try { const j = await api('/api/share/mine'); S.mine = j.shares || []; S.err = ''; } catch (e) { S.err = e.offline ? 'You\'re offline.' : ''; S.mine = S.mine || []; } paint(); }
  function paint() {
    if (!S || !S.el.isConnected) return;
    let h = L.top('Share a deck', '', 'tools') + `<p class="muted lb-p">Get a read-only link for one deck. Whoever opens it sees only the cards: no name, no progress. Turn it off whenever you want.</p>`;
    if (!meta.code) { h += `<div class="lb-card"><p style="margin:0">Turn on sync first (Settings → Sync). The link is tied to your sync account so only you can turn it off.</p></div>`; S.el.innerHTML = `<div class="lb shr">${h}</div>`; return; }
    if (S.made) h += `<div class="lb-card sim-res"><div class="sim-verd ok">✓ Link ready · ${S.made.n} cards${S.made.skipped ? ' (' + S.made.skipped + ' left out by the filter)' : ''}</div><input readonly value="${esc(base() + S.made.tok)}" style="width:100%;font-size:14px;padding:10px;border-radius:10px;margin-top:8px;background:transparent;color:inherit;border:1px solid rgba(127,127,127,.35)" data-sh-url><div class="lb-btns"><button class="btn" type="button" data-sh-copy="${S.made.tok}">Copy</button>${navigator.share ? `<button class="btn pri" type="button" data-sh-send="${S.made.tok}">Share…</button>` : ''}</div></div>`;
    const decks = live(M.decks).filter(d => !d.del).map(d => [d, live(M.notes).filter(n => n.deck === d.id).length]).filter(x => x[1]).sort((a, b) => a[0].name.localeCompare(b[0].name));
    h += `<div class="lb-group">${decks.map(([d, n]) => `<button type="button" class="lb-row" data-sh-deck="${esc(d.id)}" ${S.busy ? 'disabled' : ''}><span class="lb-rt"><span class="t1">${esc(d.name)}</span><span class="t2">${n} note${n === 1 ? '' : 's'} · tap to make a link</span></span><span class="lb-chev">🔗</span></button>`).join('') || '<p class="muted">No decks with cards yet.</p>'}</div>`;
    const mine = (S.mine || []).filter(x => !x.revoked);
    h += `<h3 style="margin-top:22px">Your links</h3>${S.mine == null ? '<p class="muted small">Loading…</p>' : mine.length ? `<div class="lb-card">${mine.map(x => `<div style="display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(127,127,127,.15)"><span style="flex:1;min-width:0"><b>${esc(x.name)}</b><div class="muted small">${x.n} cards · opened ${x.views}×</div></span><button class="btn" type="button" data-sh-copy="${esc(x.tok)}" style="min-height:36px;padding:4px 10px">Copy</button><button class="btn bad" type="button" data-sh-off="${esc(x.tok)}" style="min-height:36px;padding:4px 10px">Turn off</button></div>`).join('')}</div>` : '<p class="muted small">No active links.</p>'}${S.err ? `<p class="muted small">${esc(S.err)}</p>` : ''}`;
    S.el.innerHTML = `<div class="lb shr">${h}</div>`;
  }
  async function make(did) {
    const d = M.decks.get(did); if (!d) return; S.busy = 1; paint();
    const cards = live(M.notes).filter(n => n.deck === did).map(n => n.type === 'cloze' ? [String(n.front).replace(/\{\{c\d+::([\s\S]*?)(::[\s\S]*?)?\}\}/g, '[…]'), String(n.front).replace(/\{\{c\d+::([\s\S]*?)(::[\s\S]*?)?\}\}/g, '$1') + (n.back ? '\n' + n.back : '')] : [n.front, n.back]);
    try { const j = await api('/api/share', { method: 'POST', body: JSON.stringify({ name: d.name, cards }) }); S.made = j; try { toast('Link ready'); } catch (e) {} await refresh(); }
    catch (e) { try { toast(e.message === 'too_many_links' ? 'Turn off an old link first (25 max)' : e.message === 'filtered' ? 'That deck can\'t be shared' : e.offline ? 'You\'re offline' : 'Couldn\'t make the link'); } catch (x) {} }
    S.busy = 0; paint(); window.scrollTo(0, 0);
  }
  async function copy(tok) { const u = base() + tok; try { await navigator.clipboard.writeText(u); toast('Link copied'); } catch (e) { const i = S.el.querySelector('[data-sh-url]'); if (i) { i.select(); try { document.execCommand('copy'); toast('Link copied'); } catch (x) {} } } }
  function onClick(e) {
    if (!S) return; const t = e.target;
    const d = t.closest('[data-sh-deck]'); if (d && !S.busy) { make(d.dataset.shDeck); return; }
    const c = t.closest('[data-sh-copy]'); if (c) { copy(c.dataset.shCopy); return; }
    const s = t.closest('[data-sh-send]'); if (s) { navigator.share({ title: 'Flashcards', url: base() + s.dataset.shSend }).catch(() => {}); return; }
    const o = t.closest('[data-sh-off]'); if (o) { api('/api/share/revoke', { method: 'POST', body: JSON.stringify({ tok: o.dataset.shOff }) }).then(() => { try { toast('Link turned off'); } catch (x) {} if (S.made && S.made.tok === o.dataset.shOff) S.made = null; refresh(); }).catch(() => { try { toast('Couldn\'t turn it off. Try again.'); } catch (x) {} }); }
  }
  window.LabMods.share = { render, _S: () => S };
})();
