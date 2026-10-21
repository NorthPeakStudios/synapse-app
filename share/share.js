/* Read-only shared deck page: shows only the deck's cards (no owner name, no progress). */
(function () {
  'use strict';
  const app = document.getElementById('app'), t = (new URLSearchParams(location.search).get('t') || location.hash.slice(1) || '').replace(/[^0-9a-z]/g, '');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let D = null, i = 0, flip = false, mode = 'flash', order = [];
  function paint() {
    const c = D.cards[order[i]];
    let h = `<p class="mut sm">Shared deck · read-only</p><h1>${esc(D.name)}</h1><p class="mut sm">${D.n} card${D.n === 1 ? '' : 's'}</p><div class="tabs"><button data-m="flash" class="${mode === 'flash' ? 'on' : ''}">Flashcards</button><button data-m="list" class="${mode === 'list' ? 'on' : ''}">List</button></div>`;
    if (mode === 'flash') h += `<div class="card" data-flip>${esc(c[0])}${flip ? `<div class="b">${esc(c[1])}</div>` : ''}</div><p class="mut sm" style="text-align:center">${flip ? '&nbsp;' : 'Tap the card to flip'}</p><div class="row"><button class="btn" data-prev>◀ Prev</button><span class="mut" style="align-self:center">${i + 1} / ${D.cards.length}</span><button class="btn pri" data-next>Next ▶</button></div><div style="text-align:center"><button class="btn" data-shuf>🔀 Shuffle</button></div>`;
    else h += D.cards.map(x => `<div class="li">${esc(x[0])}<div class="b">${esc(x[1])}</div></div>`).join('');
    h += `<p class="foot mut sm">Made with Synapse</p>`;
    app.innerHTML = h;
  }
  app.addEventListener('click', e => {
    const t2 = e.target; const m = t2.closest('[data-m]'); if (m) { mode = m.dataset.m; paint(); return; }
    if (t2.closest('[data-flip]')) { flip = !flip; paint(); return; }
    if (t2.closest('[data-next]')) { i = (i + 1) % D.cards.length; flip = false; paint(); return; }
    if (t2.closest('[data-prev]')) { i = (i - 1 + D.cards.length) % D.cards.length; flip = false; paint(); return; }
    if (t2.closest('[data-shuf]')) { for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; } i = 0; flip = false; paint(); }
  });
  if (!t) { app.innerHTML = '<h1>No deck here</h1><p class="mut">This link is missing its code.</p>'; return; }
  fetch('/api/s/' + t, { cache: 'no-store' }).then(r => r.json().then(j => [r.status, j])).then(([st, j]) => {
    if (!j || !j.ok) { app.innerHTML = st === 410 ? '<h1>Link turned off</h1><p class="mut">The owner stopped sharing this deck.</p>' : '<h1>Deck not found</h1><p class="mut">Check the link and try again.</p>'; return; }
    D = j; order = D.cards.map((_, k) => k); document.title = D.name + ' · shared deck'; paint();
  }).catch(() => { app.innerHTML = '<h1>Offline</h1><p class="mut">Connect to the internet to open this deck.</p>'; });
})();
// no zoom on iPhone (pinch / double-tap)
(function(){if(window.__npNoZoom)return;window.__npNoZoom=1;var p=function(e){e.preventDefault()},o={passive:false};['gesturestart','gesturechange','gestureend'].forEach(function(t){document.addEventListener(t,p,o)});document.addEventListener('dblclick',function(e){var t=e.target;if(!(t&&t.closest&&t.closest('input,textarea,select,[contenteditable]')))e.preventDefault()},o);var b=function(e){var t=e.target;if(t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)&&parseFloat(getComputedStyle(t).fontSize)<16)t.style.fontSize='16px'};document.addEventListener('touchstart',b,{passive:true,capture:true});document.addEventListener('focusin',b,true)})();
