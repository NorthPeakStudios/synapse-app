/* Import from Anki: a front door to the app's on-device importer (.apkg / .colpkg / Anki "Notes in plain text" .txt / CSV). Everything happens on the phone: nothing is uploaded. Sound is left out and every note passes the content filter. */
(function () {
  'use strict';
  const L = window.Lab;
  function render(el) {
    el.innerHTML = `<div class="lb">${L.top('Import from Anki', '', 'tools')}
      <p class="muted lb-p">Bring in decks you made or downloaded in Anki. It all happens on your phone; nothing is uploaded except your synced cards.</p>
      <div class="lb-card"><p style="margin:0 0 8px"><b>Works with</b></p><p class="muted small" style="margin:0">• <b>.apkg</b> (a deck) and <b>.colpkg</b> (a whole collection), images kept<br>• Anki's <b>Notes in Plain Text (.txt)</b> export<br>• CSV / TSV (front, back, tags)</p></div>
      <div class="lb-card"><p style="margin:0 0 8px"><b>What gets left out</b></p><p class="muted small" style="margin:0">Sound and video clips, and any card with doses or off-limits topics. You'll see how many were skipped.</p></div>
      <div class="lb-btns"><label class="btn pri oc-file">Choose a file<input type="file" data-ak-file accept=".apkg,.colpkg,.txt,.csv,.tsv,application/zip,text/plain,text/csv" hidden></label></div>
      <p class="muted small" data-imp-status aria-live="polite" style="margin-top:12px;min-height:1.2em"></p>
      <p class="lb-foot">On iPhone: share the file from Files, Mail or Anki to this app's file picker. Big collections can take a minute.</p></div>`;
    const i = el.querySelector('[data-ak-file]');
    i.onchange = () => { const f = i.files && i.files[0]; if (f) { importFile(f).finally(() => { i.value = ''; }); } };
  }
  window.LabMods.anki = { render };
})();
