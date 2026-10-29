/* Confidence tags (v179): optional Guess / Think so / Sure buttons on each card in normal review, before Show answer.
   The tag and the grade you then give are logged on this phone only (localStorage l20.ctag); nothing about scheduling changes.
   The report lives in Study tools → Confidence tags (feat/lab/tools20.js). Off until turned on there. */
(function () {
  'use strict';
  if (window.CTag) return;
  const KEY = 'l20.ctag', LV = [[1, 'Guess'], [2, 'Think so'], [3, 'Sure']];
  function get() { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && typeof o === 'object') { o.log = Array.isArray(o.log) ? o.log : []; return o; } } catch (e) {} return { on: 0, log: [] }; }
  function put(o) { o.at = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  let pick = null, pickCid = null;
  const curC = () => { try { return window.curCard ? window.curCard() : null; } catch (e) { return null; } };
  function paint() {
    const v = document.getElementById('v-study'); if (!v || v.hidden) return;
    const row = v.querySelector('.ct-row'), c = curC();
    if (!get().on || !c) { if (row) row.remove(); return; }
    if (pickCid !== c.id) { pick = null; pickCid = c.id; }
    const bar = v.querySelector('#ansbar'); if (!bar) return;
    const html = `<div class="ct-row" role="group" aria-label="How sure are you?"><span>How sure?</span>${LV.map(([k, n]) => `<button type="button" class="ct-b${pick === k ? ' on' : ''}" data-ct="${k}" aria-pressed="${pick === k}">${n}</button>`).join('')}</div>`;
    if (!row) bar.insertAdjacentHTML('beforebegin', html);
    else if (row.dataset.cid !== c.id) row.outerHTML = html;
    const r2 = v.querySelector('.ct-row'); if (r2) r2.dataset.cid = c.id;
  }
  let q = 0; const later = () => { if (q) return; q = 1; Promise.resolve().then(() => { q = 0; paint(); }); };
  function watch() { const v = document.getElementById('v-study'); if (!v) return; new MutationObserver(later).observe(v, { childList: true, subtree: true }); new MutationObserver(later).observe(v, { attributes: true, attributeFilter: ['hidden'] }); }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-ct]'); if (!b) return;
    const k = +b.dataset.ct; pick = pick === k ? null : k; pickCid = (curC() || {}).id || null;
    document.querySelectorAll('.ct-row .ct-b').forEach(x => { const on = +x.dataset.ct === pick; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
  });
  // record the tag with the grade the card actually got (wraps the app's grade(); the original runs unchanged)
  if (typeof grade === 'function' && !grade._ct) {
    const og = grade;
    const wrapped = function (g) {
      try { const c = curC(); if (c && pick && pickCid === c.id && typeof shown !== 'undefined' && shown) { const D = get(); if (D.on) { D.log.push({ cid: c.id, deck: c.deck, l: pick, g: +g, t: Date.now() }); D.log = D.log.slice(-3000); put(D); } } } catch (e) {}
      pick = null; return og.apply(this, arguments);
    };
    wrapped._ct = 1; grade = wrapped; // eslint-disable-line no-global-assign
  }
  window.CTag = { get, setOn(v) { const D = get(); D.on = v ? 1 : 0; put(D); later(); }, clear() { const D = get(); D.log = []; put(D); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})();
