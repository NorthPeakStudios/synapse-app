/* XView: one view (#v-x) that hosts feature modules: go('x') after setting XView.mod. */
'use strict';
(function () {
  const MODS = {
    focus: { title: 'Focus', render: el => Focus.render(el) },
    rx: { title: 'Interactions', render: el => window.Interact && Interact.render(el) },
  };
  let cur = null;
  function open(name) { cur = name; go('x'); }
  function render() {
    const el = $('#v-x'), m = MODS[cur]; if (!el) return;
    if (!m) { el.innerHTML = '<div class="empty">Nothing here.</div>'; return; }
    $('#title').textContent = m.title || '';
    el.innerHTML = '<div class="x-host"></div>';
    try { m.render(el.firstChild); } catch (e) { console.warn(e); el.innerHTML = '<div class="empty">Couldn\'t open this.</div>'; }
  }
  // stop the voice / mic when leaving the speaking screen
  document.addEventListener('click', e => { if (cur === 'speak' && e.target.closest('[data-go], #homeBtn, [data-goto-home], [data-tile], [data-nmi]') && window.Speak) { try { Speak.stop(); } catch (er) {} } }, true);
  window.XView = { open, render, MODS };
})();
