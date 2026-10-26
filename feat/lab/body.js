/* Body map (v173): every card you own, sorted onto a human body by system, coloured by how likely you are to remember it
   right now. Sorting is a keyword guess (card text + tags + deck name), labelled as one. Recall % = the FSRS-5 retrievability
   Synapse already uses to schedule (retr(days since last review, stability)), averaged over reviewed cards. Read-only. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  const SYS = [
    ['neuro', 'Brain & nerves', 'brain|neuro|nerve|cerebr|cortex|cerebell|spinal cord|seizure|epilep|stroke|dementia|alzheim|parkinson|migraine|dopamin|serotonin|gaba|glutamat|acetylcholin|synap|antidepress|antipsychot|ssri|snri|benzodiazep|opioid|anesthe|anaesthe|cranial|mening|sclerosis|schizo|depress|anxiety|hippocamp|thalam|axon|neuron|myelin|reflex|analges|dementia|sedat|hypnotic|lithium|ach\\b'],
    ['endo', 'Hormones & glands', 'thyroid|insulin|diabet|glucose|glyc|hormone|endocrin|pituitar|adrenal|cortisol|corticoster|glucocortic|parathyroid|growth hormone|metformin|levothyrox|cushing|addison|glucagon|hypothalam|sulfonylure|aldosteron'],
    ['heart', 'Heart & vessels', 'heart|cardi|coronar|aort|arter|veins?\\b|venous|blood pressure|hypertens|hypotens|arrhythm|atrial|atria\\b|ventric|myocard|angina|infarct|statin|cholesterol|lipid|beta.?block|ace inhibitor|digoxin|anticoag|warfarin|heparin|thromb|embol|ecg|ekg|valve|murmur|pulse|vascular|vasodilat|vasoconstrict|nitroglycerin|calcium channel'],
    ['lungs', 'Lungs & airway', 'lung|pulmon|respir|breath|asthma|copd|bronch|alveol|pneumon|trache|ventilat|inhaler|albuterol|salbutamol|airway|pleura|tubercul|cough|emphysema|surfactant|spiromet'],
    ['liver', 'Liver & metabolism', 'liver|hepat|cirrho|jaundice|bilirubin|cytochrome|cyp\\d|cyp450|first.pass|biotransform|acetaminophen|paracetamol|gallbladder|bile'],
    ['gi', 'Gut', 'stomach|gastr|intestin|bowel|colon|digest|esophag|oesophag|duoden|ileum|jejun|rectum|crohn|colitis|ulcer|proton pump|omeprazol|antacid|nausea|vomit|emesis|diarrh|constipat|pancrea|appendi|celiac|coeliac|peptic|laxative'],
    ['kidney', 'Kidneys & urine', 'kidney|renal|nephr|urin|bladder|glomerul|diuretic|furosemide|thiazide|dialysis|creatinin|electrolyte|hyperkal|hypokal|hyponat|hypernat|ureter|potassium|sodium'],
    ['repro', 'Reproduction', 'uter|ovar|pregnan|estrogen|oestrogen|progest|testosteron|testic|testis|sperm|menstru|fetus|fetal|foetal|placent|contracept|prostat|breast|cervi|vagin|penis|erectile|gonad|embryo'],
    ['msk', 'Muscles & bones', 'muscle|muscul|bone|skelet|joint|tendon|ligament|fractur|osteo|arthrit|cartilag|femur|tibia|fibula|humer|radius|ulna|vertebra|scapula|clavic|pelvi|sarcomere|actin|myosin|gout|patella|skull|rib\\b|ribs\\b'],
    ['blood', 'Blood, immune & germs', 'blood cell|anemi|anaemi|hemoglob|haemoglob|platelet|leuk|lymph|immun|antibod|antigen|vaccin|neutrophil|t.cell|b.cell|cytokine|inflamm|allerg|histamin|infect|bacteri|virus|viral|antibiot|penicill|cephalospor|antifung|antivir|sepsis|hiv|malaria|spleen|marrow|coagul|microb|pathogen|parasit|fungal'],
    ['skin', 'Skin', 'skin|derm|rash|eczema|psoria|acne|melanom|burns?\\b|wound|epiderm|hair\\b|nails?\\b|sweat|urticaria|blister']
  ].map(([k, n, re]) => ({ k, n, re: new RegExp('\\b(?:' + re + ')', 'gi') }));
  const NAME = Object.fromEntries(SYS.map(s => [s.k, s.n]));
  const plain = h => String(h || '').replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '$1').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  function sortCard(c, note, deckName) {
    const txt = plain(note.front) + ' ' + plain(note.back) + ' ' + (note.tags || []).join(' ') + ' ' + deckName;
    let best = null, bn = 0; for (const s of SYS) { s.re.lastIndex = 0; const m = txt.match(s.re); const n = m ? m.length : 0; if (n > bn) { bn = n; best = s.k; } }
    return best;
  }
  function recallNow(c, now) { if (!(c.st === 2 || c.st === 3) || !c.s || !c.last) return null; const t = Math.max(0, (dayStart(now) - dayStart(c.last)) / DAY); return retr(t, c.s); }
  function data() {
    const now = Date.now(), R = {}; let off = 0, total = 0;
    for (const s of SYS) R[s.k] = { n: 0, nw: 0, lr: 0, rv: 0, sum: 0, weak: [] };
    const dn = {}; for (const d of M.decks.values()) dn[d.id] = d.del ? null : d.name;
    for (const c of M.cards.values()) {
      if (c.del || c.susp || dn[c.deck] == null) continue; const note = M.notes.get(c.nid); if (!note || note.del) continue; total++;
      const k = sortCard(c, note, dn[c.deck] || ''); if (!k) { off++; continue; }
      const r = R[k]; r.n++; const p = recallNow(c, now);
      if (!c.st) r.nw++; else if (p == null) r.lr++; else { r.rv++; r.sum += p; r.weak.push({ c, p, note }); }
    }
    for (const k in R) { const r = R[k]; r.p = r.rv ? r.sum / r.rv : null; r.weak.sort((a, b) => a.p - b.p); r.weak = r.weak.slice(0, 6); }
    return { R, off, total };
  }
  function col(r) { if (!r || !r.n) return 'var(--fill2,#e5e5ea)'; if (r.p == null) return '#64d2ff'; const p = r.p; return p >= 0.9 ? '#30d158' : p >= 0.8 ? '#a4d65e' : p >= 0.65 ? '#ffd60a' : p >= 0.5 ? '#ff9f0a' : '#ff453a'; }
  // stylised front view; viewer's left = the body's right (liver sits there)
  function svg(d, pick) {
    const f = k => `fill="${col(d.R[k])}" data-bm="${k}" class="bm-r${pick === k ? ' on' : ''}"`;
    return `<svg class="bm-svg" viewBox="0 0 200 372" role="img" aria-label="Body map of your cards by system">
      <g ${f('msk')}><path d="M60 92 L44 104 L30 196 L22 224 L32 228 L44 200 L58 128 Z"/><path d="M140 92 L156 104 L170 196 L178 224 L168 228 L156 200 L142 128 Z"/><path d="M70 206 L98 210 L94 300 L92 360 L74 362 L72 300 Z"/><path d="M130 206 L102 210 L106 300 L108 360 L126 362 L128 300 Z"/></g>
      <path class="bm-base" d="M86 66 h28 v14 q24 4 30 14 l-4 34 -6 78 q-2 10 -8 12 h-52 q-6 -2 -8 -12 l-6 -78 -4 -34 q6 -10 30 -14 Z"/>
      <ellipse ${f('neuro')} cx="100" cy="36" rx="25" ry="29"/>
      <path ${f('endo')} d="M91 72 q4 -5 9 0 q5 -5 9 0 q0 7 -9 7 q-9 0 -9 -7Z"/>
      <ellipse ${f('lungs')} cx="83" cy="124" rx="13" ry="25"/><ellipse ${f('lungs')} cx="117" cy="124" rx="13" ry="25"/>
      <path ${f('heart')} d="M106 118 c6 -8 18 -2 13 8 c-3 6 -10 11 -13 14 c-3 -3 -10 -8 -13 -14 c-5 -10 7 -16 13 -8Z"/>
      <path ${f('liver')} d="M70 154 q14 -8 34 -2 q-2 10 -16 14 q-12 3 -18 -2 Z"/>
      <g ${f('gi')}><ellipse cx="114" cy="160" rx="13" ry="9"/><rect x="80" y="172" width="40" height="26" rx="12"/></g>
      <g ${f('kidney')}><ellipse cx="70" cy="180" rx="6" ry="11"/><ellipse cx="130" cy="180" rx="6" ry="11"/></g>
      <ellipse ${f('repro')} cx="100" cy="212" rx="15" ry="8"/>
      <g ${f('blood')}><circle cx="170" cy="62" r="14"/><path d="M170 52 q-6 8 -6 12 a6 6 0 0 0 12 0 q0 -4 -6 -12Z" fill="#fff" opacity=".85" data-bm="blood"/></g><text x="170" y="88" font-size="9" text-anchor="middle" fill="currentColor" opacity=".7">blood</text>
      <g ${f('skin')}><circle cx="30" cy="62" r="14"/><path d="M22 58 q8 -6 16 0 M22 64 q8 -6 16 0 M22 70 q8 -6 16 0" fill="none" stroke="#fff" stroke-width="1.6" opacity=".85" data-bm="skin"/></g><text x="30" y="88" font-size="9" text-anchor="middle" fill="currentColor" opacity=".7">skin</text>
    </svg>`;
  }
  let S = null;
  function render(el) { S = { el, pick: null }; if (!el.__bm) { el.__bm = 1; el.addEventListener('click', onClick); } paint(); }
  const pct = p => Math.round(p * 100) + '%';
  function paint() {
    if (!S || !S.el.isConnected) return; const d = data(); S.d = d;
    let h = L.top('Body map', d.total ? d.total + ' cards' : '', 'tools') + `<p class="muted lb-p">Every card you own, placed on the body by what it's about and coloured by how likely you are to remember it today. Tap a part.</p>`;
    if (!d.total) { S.el.innerHTML = `<div class="lb bm">${h}<div class="lb-empty">No cards yet. Add or import a deck and it fills in.</div></div>`; return; }
    h += `<div class="bm-wrap">${svg(d, S.pick)}</div><div class="bm-leg"><span><i style="background:#ff453a"></i>&lt;50%</span><span><i style="background:#ff9f0a"></i>50–65</span><span><i style="background:#ffd60a"></i>65–80</span><span><i style="background:#a4d65e"></i>80–90</span><span><i style="background:#30d158"></i>90%+</span><span><i style="background:#64d2ff"></i>not reviewed yet</span></div>`;
    const k = S.pick, r = k && d.R[k];
    if (r) {
      h += `<div class="lb-card bm-pn"><h3>${esc(NAME[k])}</h3>${r.n ? `<div class="bm-stats"><div><b>${r.n}</b><span>cards</span></div><div><b>${r.nw}</b><span>new</span></div><div><b>${r.lr}</b><span>learning</span></div><div><b>${r.p == null ? '–' : pct(r.p)}</b><span>recall today</span></div></div>` : '<p class="muted">No cards land here yet.</p>'}
        ${r.weak.length ? `<div class="mx-h">Shakiest right now</div>${r.weak.map(w => `<div class="bm-w"><span>${esc(plain(w.c.ord === 1 ? w.note.back : w.note.front).slice(0, 90))}</span><b style="color:${col({ n: 1, p: w.p })}">${pct(w.p)}</b></div>`).join('')}` : ''}</div>`;
    } else h += `<div class="lb-note">Tap any part of the body, or the two circles up top for blood/immune/germs and skin.</div>`;
    h += `<div class="lb-group bm-list">${SYS.map(s => { const x = d.R[s.k]; return `<button type="button" class="lb-row" data-bm="${s.k}"><span class="bm-dot" style="background:${col(x)}"></span><span class="lb-rt"><span class="t1">${esc(s.n)}</span><span class="t2">${x.n} card${x.n === 1 ? '' : 's'}${x.p != null ? ' · ' + pct(x.p) + ' recall today' : x.n ? ' · not reviewed yet' : ''}</span></span></button>`; }).join('')}</div>`;
    h += `<p class="lb-foot">How it works: cards are sorted by keywords in their text, tags and deck name, so it's a best guess and some cards land in the wrong place${d.off ? ` (${d.off} card${d.off === 1 ? '' : 's'} didn't match any part and aren't shown)` : ''}. Recall % is the same memory model (FSRS) that schedules your reviews, averaged over cards you've reviewed. It's an estimate, not a test score.</p>`;
    S.el.innerHTML = `<div class="lb bm">${h}</div>`;
  }
  function onClick(e) { const t = e.target.closest('[data-bm]'); if (!t || !S) return; const k = t.dataset.bm; S.pick = S.pick === k ? null : k; paint(); if (S.pick && t.closest('.bm-list')) { const p = S.el.querySelector('.bm-wrap'); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
  window.LabMods.body = { render, _data: data, _sort: sortCard };
})();
