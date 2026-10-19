/* Neuro exam sim: a virtual patient. Tap the head or a limb, run real bedside tests (cranial nerves, strength, tone, reflexes, plantar, sensation, coordination, gait, Romberg), read the findings, then localise the lesion. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  let D = null, S = null;
  const HEAD = [['ms', 'Mental status + speech'], ['cn1', 'CN I · smell'], ['cn2', 'CN II · vision + fields'], ['pupil', 'Pupils · CN II/III'], ['eom', 'Eye movements · III, IV, VI'], ['cn5', 'CN V · face feeling + jaw'], ['cn7', 'CN VII · face movement'], ['cn8', 'CN VIII · hearing'], ['cn9', 'CN IX/X · palate + voice'], ['cn11', 'CN XI · shrug'], ['cn12', 'CN XII · tongue']];
  const LIMB = [['str', 'Strength'], ['tone', 'Tone + bulk'], ['ref', 'Reflexes'], ['bab', 'Plantar (Babinski)', 'leg'], ['pt', 'Pinprick + temperature'], ['vib', 'Vibration + position'], ['crd', 'Coordination']];
  const WHOLE = [['gait', 'Gait'], ['romberg', 'Romberg (feet together, eyes closed)']];
  const ZN = { head: 'Head', ra: 'Right arm', la: 'Left arm', rl: 'Right leg', ll: 'Left leg', whole: 'Walk + balance' };
  const ORDER = ['head', 'ra', 'la', 'rl', 'll', 'whole'];
  function render(el) {
    S = { el, mode: 'menu' };
    if (!el.__nx) { el.__nx = 1; el.addEventListener('click', onClick); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    L.json('feat/lab/neuro.json').then(d => { D = d; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  function testsFor(z) { if (z === 'head') return HEAD; if (z === 'whole') return WHOLE; return LIMB.filter(t => !t[2] || z[1] === 'l'); }
  function keyOf(z, t) { return (z === 'head' || z === 'whole') ? t : t + '.' + z; }
  function label(k) { const [t, z] = k.split('.'); const all = HEAD.concat(LIMB, WHOLE); const n = (all.find(x => x[0] === t) || [, t])[1]; return z ? ZN[z] + ': ' + (t === 'crd' ? (z[1] === 'a' ? 'Finger-to-nose' : 'Heel-to-shin') : n.split(' (')[0]) : n.split(' · ')[0].replace(' (feet together, eyes closed)', ''); }
  function find(c, k) {
    const [t, z] = k.split('.'), f = c.f, nl = c.nl || [];
    let txt = f[k], ab = txt != null;
    if (txt == null && z && f[t] != null) { txt = f[t]; ab = true; }
    if (txt == null) txt = D.norm[z ? t + (z[1] === 'a' ? '_a' : '_l') : t] || D.norm[t] || 'Normal.';
    if (nl.includes(k) || nl.includes(t)) ab = false;
    return { txt, ab };
  }
  function figure() {
    const z = S.zone, seen = ORDER.filter(x => Object.keys(S.done).some(k => x === 'head' ? !k.includes('.') && !['gait', 'romberg'].includes(k) : x === 'whole' ? ['gait', 'romberg'].includes(k) : k.endsWith('.' + x)));
    const c = n => `z${z === n ? ' on' : ''}${seen.includes(n) ? ' seen' : ''}`;
    return `<svg class="nx-svg" viewBox="0 0 120 230" role="img" aria-label="Patient: tap the head, an arm or a leg">
      <circle class="${c('head')}" data-nx-z="head" cx="60" cy="24" r="19"/>
      <rect class="${c('whole')}" data-nx-z="whole" x="38" y="47" width="44" height="72" rx="12"/>
      <rect class="${c('ra')}" data-nx-z="ra" x="14" y="50" width="20" height="78" rx="10" transform="rotate(8 24 50)"/>
      <rect class="${c('la')}" data-nx-z="la" x="86" y="50" width="20" height="78" rx="10" transform="rotate(-8 96 50)"/>
      <rect class="${c('rl')}" data-nx-z="rl" x="39" y="122" width="20" height="100" rx="10"/>
      <rect class="${c('ll')}" data-nx-z="ll" x="61" y="122" width="20" height="100" rx="10"/>
      <text x="18" y="146">R</text><text x="96" y="146">L</text><text x="47" y="88">gait</text></svg>`;
  }
  function paint() {
    if (!S || !S.el.isConnected) return; let h = '';
    if (S.mode === 'menu') {
      const st = L.stat('neuro');
      h = L.top('Neuro exam sim', st ? `avg ${st.avg}%` : '', 'lab') + `<p class="muted lb-p">A patient walks in with a neuro complaint. Examine them like a neurologist: tap the head or a limb, run the tests, read the findings, then say where the lesion is. ${D.cases.length} patients.</p>
        <div class="lb-card lz-intro"><b>How localisation works</b><ul><li><b>Upper motor neuron</b> (brain, cord): weak + stiff, brisk reflexes, upgoing toe.</li><li><b>Lower motor neuron</b> (nerve root, nerve): weak + floppy, wasting, twitching, lost reflexes.</li><li><b>Crossed signs</b> (face one side, body the other) = brainstem.</li><li><b>Sensory level</b> or split sensation = spinal cord.</li><li>Score = right answer + finding the key signs.</li></ul></div>
        <div class="lb-btns"><button class="btn pri" data-nx-new type="button">New patient</button></div>`;
    } else {
      const c = D.cases[S.ci];
      h = `<div class="lb-top"><button class="lb-back" type="button" data-nx-menu>${ic('back', 18)}<span>Neuro exam</span></button><span class="lb-tr">${Object.keys(S.done).length} tests</span></div>`;
      h += `<div class="nx-pt"><p class="nx-cc">${esc(c.cc)}</p></div>`;
      if (S.mode === 'exam') {
        h += `<div class="nx-body">${figure()}<div class="nx-side"><div class="nx-tabs">${ORDER.map(z => `<button type="button" data-nx-z="${z}" class="${S.zone === z ? 'on' : ''}">${ZN[z]}</button>`).join('')}</div><p class="nx-hint">They face you, so their right side is on your left.</p></div></div>`;
        h += `<div class="nx-tests">${testsFor(S.zone).map(([t, n]) => { const k = keyOf(S.zone, t), d = S.done[k]; const nm = t === 'crd' ? (S.zone[1] === 'a' ? 'Finger-to-nose' : 'Heel-to-shin') : n; return `<div class="nx-t${d ? ' nx-d' : ''}${d && d.ab ? ' nx-ab' : ''}"><button type="button" data-nx-t="${k}"><span class="d"></span>${esc(nm)}${d ? '' : '<small>tap to test</small>'}</button>${d ? `<div class="nx-f">${esc(d.txt)}</div>` : ''}</div>`; }).join('')}</div>`;
        const ab = Object.entries(S.done).filter(([, v]) => v.ab);
        h += `<div class="nx-log"><b>Abnormal findings so far (${ab.length})</b>${ab.length ? ab.map(([k, v]) => `<div><span class="ab">${esc(label(k))}</span>: ${esc(v.txt)}</div>`).join('') : '<div class="muted">None yet. Keep examining.</div>'}</div>`;
        h += `<div class="lb-btns sticky"><button class="btn pri" data-nx-loc type="button" ${Object.keys(S.done).length ? '' : 'disabled'}>Localise the lesion</button></div>`;
      } else {
        const done = S.mode === 'end';
        h += `<p class="mt-h">${done ? (S.pick === c.a ? 'Correct.' : 'Not quite.') : 'Where is the lesion?'}</p><div class="nx-opts">${S.opts.map(i => `<button type="button" data-nx-a="${i}" class="${done ? (i === c.a ? 'ok' : i === S.pick ? 'no' : '') : ''}" ${done ? 'disabled' : ''}>${esc(c.opts[i])}</button>`).join('')}</div>`;
        if (!done) h += `<div class="lb-btns"><button class="btn" data-nx-back type="button">Keep examining</button></div>`;
        else {
          const hit = c.key.filter(k => S.done[k]);
          h += `<div class="lb-card sim-res"><div class="lz-big">${S.score}%</div><div class="sim-verd ${S.score >= 70 ? 'ok' : 'bad'}">${S.pick === c.a ? 'Right localisation' : 'Wrong localisation'} · ${hit.length}/${c.key.length} key tests done</div><div class="nx-keys">${c.key.map(k => `<span class="${S.done[k] ? 'hit' : 'miss'}">${esc(label(k))}</span>`).join('')}</div></div>`;
          h += `<div class="lb-card"><p class="lb-why">${esc(c.why)}</p></div>`;
          const missed = c.key.filter(k => !S.done[k] && find(c, k).ab);
          if (missed.length) h += `<div class="nx-log"><b>Findings you didn't check</b>${missed.map(k => `<div><span class="ab">${esc(label(k))}</span>: ${esc(find(c, k).txt)}</div>`).join('')}</div>`;
          h += `<div class="lb-btns"><button class="btn" data-nx-menu type="button">Done</button><button class="btn pri" data-nx-new type="button">Next patient</button></div>`;
        }
      }
    }
    S.el.innerHTML = `<div class="lb nx">${h}</div>`;
  }
  function newCase() {
    const st = (L._S().sc.neuro) || {}; const pool = D.cases.map((c, i) => i);
    const unseen = pool.filter(i => !st[D.cases[i].id]);
    const from = unseen.length ? unseen : pool.filter(i => i !== S.ci);
    S.ci = from[Math.floor(Math.random() * from.length)]; S.done = {}; S.zone = 'head'; S.mode = 'exam'; S.pick = null;
    S.opts = L.shuffle(D.cases[S.ci].opts.map((o, i) => i)); paint(); window.scrollTo(0, 0);
  }
  function answer(i) {
    const c = D.cases[S.ci]; S.pick = i; const hit = c.key.filter(k => S.done[k]).length;
    S.score = Math.round((i === c.a ? 60 : 0) + 40 * hit / c.key.length); S.mode = 'end'; L.fx(i === c.a);
    L.result('neuro', c.id, S.score);
    L.mastery({ id: 'NX:' + c.id, tags: ['neuro exam', 'localisation'], ok: i === c.a, choices: c.opts.length, label: c.opts[c.a], src: 'neuro' });
    L.award('neuro', 3 + Math.round(S.score / 20)); paint(); window.scrollTo(0, 0);
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    if (t.closest('[data-nx-menu]')) { S.mode = 'menu'; paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-nx-new]')) { newCase(); return; }
    if (t.closest('[data-nx-back]')) { S.mode = 'exam'; paint(); return; }
    if (t.closest('[data-nx-loc]')) { S.mode = 'loc'; paint(); window.scrollTo(0, 0); return; }
    const z = t.closest('[data-nx-z]'); if (z && S.mode === 'exam') { S.zone = z.dataset.nxZ; const y = window.scrollY; paint(); window.scrollTo(0, y); return; }
    const b = t.closest('[data-nx-t]'); if (b && S.mode === 'exam') { const k = b.dataset.nxT; if (!S.done[k]) { S.done[k] = find(D.cases[S.ci], k); try { window.Prefs && Prefs.haptic(); } catch (x) {} } const y = window.scrollY; paint(); window.scrollTo(0, y); return; }
    const a = t.closest('[data-nx-a]'); if (a && S.mode === 'loc') { answer(+a.dataset.nxA); return; }
  }
  window.LabMods.neuro = { render, _S: () => S, _D: () => D };
})();
