/* Synapse study tools (v175; since v178 they open from search, no Labs section): eight study tools.
   stems · conf · autopsy · split · blurt · palace · sleep · explain. Everything runs on this phone from your own cards and
   review history; anything that is a guess (word matching, stems, reading level) says so on screen. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc; L.css2(); L.css3();
  if (!document.getElementById('l8css')) { const l = document.createElement('link'); l.id = 'l8css'; l.rel = 'stylesheet'; l.href = 'feat/lab/labs8.css?v=' + L.VER; document.head.appendChild(l); }
  const plain = h => String(h || '').replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '$1').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, ' ').trim();
  function qa(c) {
    const n = M.notes.get(c.nid); if (!n) return { q: '', a: '' };
    if (n.type === 'cloze') {
      const num = +c.ord || 1; let ans = [];
      const q = String(n.front || '').replace(/\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g, (m, k, x, hint) => { if (+k === num) { ans.push(x); return '[' + (hint || '…') + ']'; } return x; });
      return { q: plain(q), a: plain(ans.join(', ')) + (n.back ? '\n' + plain(n.back) : '') };
    }
    return c.ord === 1 ? { q: plain(n.back), a: plain(n.front) } : { q: plain(n.front), a: plain(n.back) };
  }
  const cards = (deck, f) => { const out = []; for (const c of M.cards.values()) { if (c.del) continue; const d = M.decks.get(c.deck); if (!d || d.del) continue; if (deck && deck !== '*' && c.deck !== deck) continue; if (f && !f(c)) continue; out.push(c); } return out; };
  const decksSel = (attr, cur, all = true) => { const ds = live(M.decks).sort((a, b) => a.name.localeCompare(b.name)); return `<select ${attr}>${all ? `<option value="*">All decks</option>` : ''}${ds.map(d => `<option value="${esc(d.id)}"${cur === d.id ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select>`; };
  function store(key) {
    const lk = 'l8.' + key, pid = 'lab:l8' + key;
    return {
      get(def) { let o = null; try { o = JSON.parse(localStorage.getItem(lk) || 'null'); } catch (e) {} try { const r = M.progress && M.progress.get(pid); if (r && r.data && (r.data.at || 0) > ((o && o.at) || 0)) { o = r.data; localStorage.setItem(lk, JSON.stringify(o)); } } catch (e) {} return o || def; },
      set(o) { o.at = Date.now(); try { localStorage.setItem(lk, JSON.stringify(o)); } catch (e) {} try { if (typeof write === 'function' && M.progress) write([['progress', { id: pid, t: 'lab', data: o, at: o.at, del: 0 }]]); } catch (e) {} }
    };
  }
  const STOP = new Set('the a an and or of to in on for with by is are was were be been it its this that these those as at from which who what when where how why not no but if then than into out up down over under about after before during between both each few more most other some such only own same so too very can will just do does did have has had having their there they them he she his her you your we our i me my also may might must shall should would could one two three per via eg ie etc called known used use uses type types form forms part'.split(' '));
  const words = s => String(s || '').toLowerCase().match(/[a-zäöüßéèàçñ0-9]+(?:-[a-z0-9]+)*/g) || [];
  const stem = w => w.length > 5 ? w.replace(/(ations|ation|ings|ing|ies|ied|ed|es|s)$/, '') : w.replace(/s$/, '');
  const keyTerms = s => [...new Set(words(s).filter(w => w.length >= 4 && !STOP.has(w)).map(stem))];
  const sendWeak = async ids => { let n = 0; if (!(window.Weak && Weak.addCard)) return 0; for (const id of ids) { const c = M.cards.get(id); if (c) { try { await Weak.addCard(c); n++; } catch (e) {} } } return n; };
  const pct = x => Math.round(x * 100) + '%';
  const shortQ = (c, n = 90) => { const t = qa(c).q.replace(/\s+/g, ' '); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  const recallNow = c => (c.s && c.last) ? retr(Math.max(0, (Date.now() - c.last) / DAY), c.s) : null;
  function mount(el, key, onClick, onInput) { if (el['__l8' + key]) return; el['__l8' + key] = 1; el.addEventListener('click', e => { if (el.__l8cur === key) onClick(e); }); if (onInput) { el.addEventListener('input', e => { if (el.__l8cur === key) onInput(e); }); el.addEventListener('change', e => { if (el.__l8cur === key) onInput(e); }); } }
  const head = (t, p) => L.top(t, '', 'tools') + `<p class="muted lb-p">${p}</p>`;
  const empty = (msg) => `<div class="lb-empty">${msg}</div>`;

  /* ---------- 1. Drug stem decoder ---------- */
  const STEMS = [
    ['ximab', 'chimeric monoclonal antibody', 'part mouse, part human antibody', 'rituximab, infliximab'], ['zumab', 'humanized monoclonal antibody', 'mostly human antibody with mouse binding bits', 'trastuzumab, bevacizumab'], ['umab', 'fully human monoclonal antibody', 'antibody made from human genes', 'adalimumab, nivolumab'], ['mab', 'monoclonal antibody', 'lab-made antibody aimed at one target', 'pembrolizumab'],
    ['tinib', 'tyrosine kinase inhibitor', 'blocks kinase signals that drive cell growth (cancer)', 'imatinib, erlotinib'], ['ciclib', 'CDK4/6 inhibitor', 'stops cancer cells moving through the cell cycle', 'palbociclib'], ['parib', 'PARP inhibitor', 'blocks a DNA repair enzyme in cancer cells', 'olaparib'], ['lisib', 'PI3K inhibitor', 'blocks a growth signal in blood cancers', 'idelalisib'], ['degib', 'hedgehog pathway inhibitor', 'blocks the hedgehog signal (basal cell cancer)', 'vismodegib'],
    ['platin', 'platinum chemotherapy', 'cross-links DNA', 'cisplatin, carboplatin'], ['taxel', 'taxane chemotherapy', 'freezes microtubules so cells can’t divide', 'paclitaxel, docetaxel'], ['rubicin', 'anthracycline chemotherapy', 'DNA intercalator, cardiotoxic', 'doxorubicin'], ['mustine', 'nitrosourea / nitrogen mustard alkylator', 'alkylates DNA', 'carmustine, bendamustine'], ['lutamide', 'androgen receptor blocker', 'blocks testosterone at its receptor', 'flutamide, bicalutamide'],
    ['olol', 'beta blocker', 'blocks β-adrenergic receptors (slows heart, lowers BP)', 'metoprolol, propranolol'], ['pril', 'ACE inhibitor', 'blocks angiotensin-converting enzyme', 'lisinopril, enalapril'], ['sartan', 'angiotensin II receptor blocker (ARB)', 'blocks the AT1 receptor', 'losartan, valsartan'], ['dipine', 'dihydropyridine calcium channel blocker', 'relaxes arteries via L-type Ca channels', 'amlodipine, nifedipine'], ['azosin', 'alpha-1 blocker', 'relaxes vessels and prostate smooth muscle', 'prazosin, doxazosin'], ['osin', 'alpha-1 blocker', 'relaxes prostate / vessel smooth muscle', 'tamsulosin'], ['darone', 'class III antiarrhythmic (benzofuran)', 'prolongs repolarisation', 'amiodarone, dronedarone'],
    ['vastatin', 'statin', 'HMG-CoA reductase inhibitor (lowers LDL)', 'atorvastatin, simvastatin'], ['statin', 'statin', 'HMG-CoA reductase inhibitor (lowers LDL)', 'rosuvastatin'], ['thiazide', 'thiazide diuretic', 'blocks the Na-Cl cotransporter in the distal tubule', 'hydrochlorothiazide'], ['semide', 'loop diuretic', 'blocks NKCC2 in the loop of Henle', 'furosemide'], ['parin', 'heparin-type anticoagulant', 'boosts antithrombin', 'enoxaparin, dalteparin'], ['xaban', 'factor Xa inhibitor', 'directly blocks clotting factor Xa', 'apixaban, rivaroxaban'], ['gatran', 'direct thrombin inhibitor', 'blocks thrombin (factor IIa)', 'dabigatran'], ['grel', 'P2Y12 antiplatelet', 'stops platelets sticking via the ADP receptor', 'clopidogrel, prasugrel'], ['fiban', 'GP IIb/IIIa antagonist', 'blocks the final platelet-binding step', 'tirofiban, eptifibatide'], ['plase', 'plasminogen activator (clot buster)', 'turns plasminogen into plasmin', 'alteplase, tenecteplase'],
    ['prazole', 'proton pump inhibitor', 'shuts off the stomach’s acid pump', 'omeprazole, pantoprazole'], ['tidine', 'H2 blocker', 'blocks histamine-2 receptors on acid cells', 'famotidine'], ['setron', '5-HT3 antagonist (anti-nausea)', 'blocks serotonin-3 receptors', 'ondansetron'], ['triptan', '5-HT1B/1D agonist (migraine)', 'narrows dilated head vessels, calms trigeminal nerve', 'sumatriptan'], ['lukast', 'leukotriene receptor antagonist', 'blocks leukotrienes (asthma)', 'montelukast'], ['terol', 'beta-2 agonist', 'opens airways', 'albuterol, salmeterol'], ['tropium', 'inhaled antimuscarinic', 'blocks acetylcholine in the airways', 'ipratropium, tiotropium'],
    ['gliflozin', 'SGLT2 inhibitor', 'makes the kidney dump glucose in urine', 'empagliflozin'], ['gliptin', 'DPP-4 inhibitor', 'keeps your own incretins around longer', 'sitagliptin'], ['glutide', 'GLP-1 receptor agonist', 'incretin mimic: more insulin, less appetite', 'semaglutide, liraglutide'], ['glitazone', 'thiazolidinedione', 'PPAR-γ agonist, raises insulin sensitivity', 'pioglitazone'], ['dronate', 'bisphosphonate', 'stops osteoclasts eating bone', 'alendronate'], ['relix', 'GnRH antagonist', 'blocks the GnRH receptor', 'degarelix'], ['relin', 'hormone-releasing peptide (GnRH analog)', 'acts like a releasing hormone', 'leuprorelin (leuprolide)'],
    ['olone', 'corticosteroid', 'glucocorticoid', 'prednisolone, triamcinolone'], ['onide', 'topical/inhaled corticosteroid', 'local glucocorticoid', 'budesonide, fluocinonide'], ['sone', 'corticosteroid', 'glucocorticoid', 'prednisone, dexamethasone'],
    ['coxib', 'COX-2 selective NSAID', 'blocks COX-2 only', 'celecoxib'], ['profen', 'propionic-acid NSAID', 'blocks COX-1 and COX-2', 'ibuprofen'], ['fenac', 'acetic-acid NSAID', 'blocks COX-1 and COX-2', 'diclofenac'],
    ['fentanil', 'fentanyl-family opioid', 'potent μ-opioid agonist', 'sufentanil, remifentanil'], ['codone', 'opioid (codeine-derived)', 'μ-opioid agonist', 'oxycodone, hydrocodone'], ['caine', 'local anaesthetic', 'blocks voltage-gated Na channels in nerves', 'lidocaine, bupivacaine'], ['curonium', 'non-depolarising neuromuscular blocker', 'blocks nicotinic receptors at muscle', 'rocuronium, vecuronium'], ['curium', 'non-depolarising neuromuscular blocker', 'blocks nicotinic receptors at muscle', 'atracurium'],
    ['azolam', 'benzodiazepine', 'boosts GABA-A', 'midazolam, alprazolam'], ['azepam', 'benzodiazepine', 'boosts GABA-A', 'diazepam, lorazepam'], ['barbital', 'barbiturate', 'holds GABA-A channels open longer', 'phenobarbital'], ['triptyline', 'tricyclic antidepressant', 'blocks serotonin + noradrenaline reuptake (and more)', 'amitriptyline'], ['pramine', 'tricyclic antidepressant', 'blocks serotonin + noradrenaline reuptake', 'imipramine'], ['oxetine', 'reuptake inhibitor family (SSRI/SNRI/NRI)', 'blocks serotonin and/or noradrenaline reuptake', 'fluoxetine, duloxetine, atomoxetine'], ['peridol', 'butyrophenone antipsychotic', 'strong D2 blocker', 'haloperidol'], ['apine', 'atypical antipsychotic (-apine family)', 'D2 + 5-HT2A blocker', 'clozapine, olanzapine, quetiapine'], ['done', 'atypical antipsychotic (-done family) — or a different class, check', 'D2 + 5-HT2A blocker (risperidone)', 'risperidone, ziprasidone'],
    ['cillin', 'penicillin', 'β-lactam: breaks bacterial cell-wall building', 'amoxicillin'], ['penem', 'carbapenem', 'broad-spectrum β-lactam', 'meropenem'], ['bactam', 'β-lactamase inhibitor', 'protects a penicillin from bacterial enzymes', 'tazobactam'], ['floxacin', 'fluoroquinolone', 'blocks bacterial DNA gyrase', 'ciprofloxacin'], ['cycline', 'tetracycline', 'blocks the 30S ribosome', 'doxycycline'], ['mycin', 'antibiotic from Streptomyces (macrolide or aminoglycoside, check)', 'protein-synthesis blocker', 'azithromycin, gentamicin'],
    ['navir', 'HIV protease inhibitor', 'stops HIV cutting its proteins', 'ritonavir, darunavir'], ['tegravir', 'integrase inhibitor', 'stops HIV inserting into DNA', 'dolutegravir'], ['vudine', 'nucleoside reverse transcriptase inhibitor', 'fake DNA building block for HIV', 'lamivudine, zidovudine'], ['previr', 'HCV NS3/4A protease inhibitor', 'hepatitis C protease blocker', 'glecaprevir'], ['asvir', 'HCV NS5A inhibitor', 'hepatitis C replication blocker', 'ledipasvir'], ['buvir', 'HCV NS5B polymerase inhibitor', 'hepatitis C polymerase blocker', 'sofosbuvir'], ['ciclovir', 'herpes antiviral (guanine analog)', 'chain-terminates viral DNA', 'acyclovir, valacyclovir'], ['vir', 'antiviral', 'blocks a viral step', 'oseltamivir'],
    ['fungin', 'echinocandin', 'blocks fungal cell-wall glucan', 'caspofungin'], ['conazole', 'azole antifungal', 'blocks ergosterol synthesis', 'fluconazole'], ['bendazole', 'benzimidazole anthelmintic', 'blocks worm microtubules', 'albendazole'], ['nidazole', 'nitroimidazole', 'damages DNA in anaerobes and protozoa', 'metronidazole'], ['quine', 'quinoline antimalarial', 'blocks heme detox in the parasite', 'chloroquine'],
    ['cept', 'receptor fusion protein', 'decoy receptor glued to an antibody tail', 'etanercept'], ['kinra', 'interleukin receptor antagonist', 'blocks an interleukin receptor', 'anakinra'], ['afil', 'PDE5 inhibitor', 'keeps cGMP high', 'sildenafil, tadalafil'], ['ase', 'enzyme', 'a protein that speeds a reaction', 'alteplase, asparaginase']
  ];
  const STEM_EX = { done: /(?:peri|risperi|ziprasi|lurasi|ilo|palipe)done$/ };
  function decode(name) {
    const w = String(name || '').toLowerCase().replace(/[^a-z]/g, ''); if (w.length < 4) return null;
    for (const s of STEMS) { if (w.endsWith(s[0]) && w.length > s[0].length + 1) { if (STEM_EX[s[0]] && !STEM_EX[s[0]].test(w)) continue; return { w, s }; } }
    if (/^cef|^ceph/.test(w)) return { w, s: ['cef-', 'cephalosporin', 'β-lactam related to penicillin', 'cefazolin, ceftriaxone'], pre: 1 };
    return null;
  }
  const stems = { render(el) {
    el.__l8cur = 'stems'; const st = stems; st.el = el;
    mount(el, 'stems', async e => {
      const b = e.target.closest('[data-st-ex]'); if (b) { el.querySelector('[data-st-in]').value = b.dataset.stEx; paint(); return; }
      if (e.target.closest('[data-st-scan]')) { scan(); return; }
      if (e.target.closest('[data-st-card]')) {
        const r = decode(el.querySelector('[data-st-in]').value), dk = el.querySelector('[data-st-deck]').value; if (!r || !dk) return;
        const nm = r.w[0].toUpperCase() + r.w.slice(1);
        const note = { id: 'n-' + rid(), created: Date.now(), deck: dk, type: 'basic', front: esc(`${nm}: what class is it, and what does it do?`), back: esc(`${r.s[1]} (stem ${r.pre ? r.s[0] : '-' + r.s[0]}). ${r.s[2]}.`), tags: ['stems'] };
        M.notes.set(note.id, note); await write([['notes', note], ...cardsForNote(note)]); toast('Card added'); e.target.closest('[data-st-card]').textContent = 'Added ✓';
      }
    }, e => { if (e.target.matches('[data-st-in]')) paint(); });
    el.innerHTML = `<div class="lb">${head('Drug stem decoder', 'Type any drug name. The ending usually tells you the class: drug names are built from official stems (the USAN system).')}
      <input class="l8-in" data-st-in type="search" placeholder="e.g. metoprolol, semaglutide, apixaban" autocomplete="off" autocapitalize="off" spellcheck="false">
      <div class="l8-chips">${['pembrolizumab', 'empagliflozin', 'tamsulosin', 'ondansetron', 'dolutegravir', 'rocuronium'].map(x => `<button type="button" class="l8-chip" data-st-ex="${x}">${x}</button>`).join('')}</div>
      <div data-st-out></div>
      <button type="button" class="btn lb-wide" data-st-scan>Scan my cards for stems</button><div data-st-scanout></div>
      <p class="lb-foot">Stems are a naming rule, not a guarantee: a few drugs break the pattern (and short endings like -ase or -vir are broad). Learning only, no doses.</p></div>`;
    paint();
  } };
  function paint() {
    const el = stems.el; if (!el) return; const v = el.querySelector('[data-st-in]').value.trim(), out = el.querySelector('[data-st-out]');
    if (out.dataset.v === v) return; out.dataset.v = v;
    if (!v) { out.innerHTML = ''; return; }
    const r = decode(v);
    if (!r) { out.innerHTML = `<div class="lb-card"><p>No stem I know in <b>${esc(v)}</b>. Older drugs (aspirin, digoxin, warfarin) were named before the stem system, so they have no stem.</p></div>`; return; }
    const i = r.pre ? r.s[0].length - 1 : r.w.length - r.s[0].length, body = r.pre ? r.w.slice(i) : r.w.slice(0, i), st = r.pre ? r.w.slice(0, i) : r.w.slice(i);
    out.innerHTML = `<div class="lb-card l8-stem"><div class="l8-word">${r.pre ? `<b>${esc(st)}</b>${esc(body)}` : `${esc(body)}<b>${esc(st)}</b>`}</div>
      <h3>${esc(r.s[1])}</h3><p>${esc(r.s[2])}.</p><p class="muted small">Same stem: ${esc(r.s[3])}</p>
      <div class="l8-row">${decksSel('data-st-deck', localStorage.getItem('lastDeckL8') || '', false)}<button type="button" class="btn pri" data-st-card>Make a card</button></div></div>`;
  }
  function scan() {
    const el = stems.el, by = {}; let n = 0;
    for (const c of cards('*', c => c.ord !== 1)) { const t = qa(c); for (const w of new Set(words(t.q + ' ' + t.a))) { if (w.length < 6) continue; const r = decode(w); if (r && !['ase', 'vir', 'done', 'mab', 'sone'].includes(r.s[0])) { (by[r.s[1]] || (by[r.s[1]] = new Set())).add(w); n++; } } }
    const rows = Object.entries(by).sort((a, b) => b[1].size - a[1].size);
    el.querySelector('[data-st-scanout]').innerHTML = rows.length ? `<div class="mx-h">Classes hiding in your cards</div><div class="lb-group">${rows.slice(0, 25).map(([k, s]) => `<div class="lb-row"><span class="lb-rt"><span class="t1">${esc(k)}</span><span class="t2">${esc([...s].slice(0, 6).join(', '))}</span></span><span class="l8-n">${s.size}</span></div>`).join('')}</div>` : `<div class="lb-card"><p>No stemmed drug names found in your cards yet.</p></div>`;
  }

  /* ---------- 2. Confidence check ---------- */
  const CS = store('conf');
  const conf = { render(el) {
    el.__l8cur = 'conf'; conf.el = el; conf.run = null;
    mount(el, 'conf', e => {
      const t = e.target.closest('[data-cf]'); if (!t) return; const a = t.dataset.cf, R = conf.run;
      if (a === 'start') { const dk = el.querySelector('[data-cf-deck]').value; const pool = L.shuffle(cards(dk, c => !c.susp && c.st >= 1 && qa(c).a)).slice(0, 10); if (!pool.length) { toast('No studied cards in that deck yet'); return; } conf.run = { ids: pool.map(c => c.id), i: 0, lvl: null, shown: 0, res: [] }; draw(); return; }
      if (a === 'lvl') { R.lvl = +t.dataset.v; R.shown = 1; draw(); return; }
      if (a === 'ok' || a === 'miss') { R.res.push({ l: R.lvl, ok: a === 'ok' ? 1 : 0 }); const D = CS.get({ log: [] }); D.log.push({ l: R.lvl, ok: a === 'ok' ? 1 : 0, t: Date.now() }); D.log = D.log.slice(-600); CS.set(D); R.i++; R.lvl = null; R.shown = 0; draw(); return; }
      if (a === 'home') { conf.run = null; draw(); }
    });
    draw();
  } };
  const LV = [[1, 'Guessing'], [2, 'Think so'], [3, 'Sure']];
  function calib(log) { const o = {}; for (const [k] of LV) { const xs = log.filter(x => x.l === k); o[k] = { n: xs.length, ok: xs.filter(x => x.ok).length }; } return o; }
  function draw() {
    const el = conf.el, R = conf.run; let h = head('Confidence check', 'Before you flip, say how sure you are. Over time Synapse shows whether your “sure” really means sure. Doesn’t touch your review schedule.');
    if (!R || R.i >= R.ids.length) {
      if (R) { const c = calib(R.res.map(x => ({ ...x }))); h += `<div class="lb-card"><h3>Round done: ${R.res.filter(x => x.ok).length}/${R.res.length}</h3><p class="muted small">${LV.map(([k, n]) => c[k].n ? `${n}: ${c[k].ok}/${c[k].n}` : '').filter(Boolean).join(' · ')}</p></div>`; }
      const log = CS.get({ log: [] }).log, c = calib(log);
      h += `<div class="mx-h">All-time calibration (${log.length} answers)</div><div class="lb-card">${LV.map(([k, n]) => { const x = c[k], p = x.n ? x.ok / x.n : 0; return `<div class="l8-bar"><span>${n}</span><i><b style="width:${x.n ? Math.round(p * 100) : 0}%"></b></i><em>${x.n ? pct(p) : '–'} <small>(${x.n})</small></em></div>`; }).join('')}
        <p class="small" style="margin-top:10px">${verdict(c)}</p></div>`;
      h += `<div class="l8-row">${decksSel('data-cf-deck', '*')}<button type="button" class="btn pri" data-cf="start">10 cards</button></div>`;
      el.innerHTML = `<div class="lb">${h}<p class="lb-foot">Calibration = how well your feeling of knowing matches what you actually get right. It needs about 10 answers per level before it means much.</p></div>`; return;
    }
    const c = M.cards.get(R.ids[R.i]), x = c ? qa(c) : { q: '?', a: '?' };
    h += `<div class="muted small">${R.i + 1} / ${R.ids.length}</div><div class="lb-card l8-q">${esc(x.q).replace(/\n/g, '<br>')}</div>`;
    if (!R.shown) h += `<p class="small muted">How sure are you that you know it?</p><div class="lb-btns">${LV.map(([k, n]) => `<button type="button" class="btn" data-cf="lvl" data-v="${k}">${n}</button>`).join('')}</div>`;
    else h += `<div class="lb-card l8-a">${esc(x.a).replace(/\n/g, '<br>')}</div><div class="lb-btns"><button type="button" class="btn danger" data-cf="miss">Missed it</button><button type="button" class="btn pri" data-cf="ok">Got it</button></div>`;
    h += `<button type="button" class="btn lb-wide" data-cf="home">Stop</button>`;
    el.innerHTML = `<div class="lb">${h}</div>`;
  }
  function verdict(c) {
    const s = c[3], g = c[1]; if (s.n < 10) return `Answer ${10 - s.n} more as “Sure” to see a verdict.`;
    const ps = s.ok / s.n; let v = ps >= 0.9 ? `When you say Sure you're right ${pct(ps)} of the time: well calibrated.` : ps >= 0.75 ? `Your Sure is right ${pct(ps)} of the time: a bit overconfident.` : `Your Sure is only right ${pct(ps)} of the time: you feel like you know these more than you do. Those are the cards to slow down on.`;
    if (g.n >= 10 && g.ok / g.n >= 0.6) v += ` And your guesses are right ${pct(g.ok / g.n)}: you know more than you think.`; return v;
  }

  /* ---------- 3. Card autopsy ---------- */
  const autopsy = { render(el) {
    el.__l8cur = 'autopsy'; autopsy.el = el; autopsy.id = null;
    mount(el, 'autopsy', e => { const t = e.target.closest('[data-au]'); if (t) { autopsy.id = t.dataset.au || null; drawA(); window.scrollTo(0, 0); } }, e => { if (e.target.matches('[data-au-q]')) listA(e.target.value); });
    drawA();
  } };
  function revsOf(id) { const out = []; for (const r of M.revlog.values()) if (r.cid === id && !r.del) out.push(r); return out.sort((a, b) => a.t - b.t); }
  function drawA() {
    const el = autopsy.el, id = autopsy.id;
    if (!id) {
      el.innerHTML = `<div class="lb">${head('Card autopsy', 'Pick a card to see its whole life: every review, how your memory of it grew or crashed, and clues to why it won’t stick.')}<input class="l8-in" data-au-q type="search" placeholder="Search your cards" autocomplete="off"><div data-au-list></div></div>`;
      listA(''); return;
    }
    const c = M.cards.get(id); if (!c) { autopsy.id = null; drawA(); return; }
    const rv = revsOf(id), x = qa(c), r = recallNow(c), took = rv.map(v => v.took || 0).filter(Boolean);
    const med = arr => { const s = arr.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
    const allTook = []; for (const v of M.revlog.values()) if (v.took) allTook.push(v.took); const myMed = med(took), allMed = med(allTook);
    const clues = [], aw = words(x.a).length;
    if (aw > 18) clues.push(`The answer is ${aw} words long. Long answers get graded as a miss if any piece slips. Try Leech splitter.`);
    else if ((x.a.match(/[,;\n•]/g) || []).length >= 2) clues.push('The answer is a list. Lists are easier as one card per item (Leech splitter can do that).');
    if (myMed && allMed && myMed > allMed * 1.8 && took.length >= 2) clues.push(`You think about it ${Math.round(myMed / 1000)}s on average vs your usual ${Math.round(allMed / 1000)}s, so you're reconstructing it, not remembering it.`);
    const kt = new Set(keyTerms(x.a)); let twin = null, best = 0;
    if (kt.size >= 2) for (const o of cards(c.deck, o => o.id !== c.id && o.nid !== c.nid)) { const k2 = keyTerms(qa(o).a); if (!k2.length) continue; const sh = k2.filter(w => kt.has(w)).length / Math.min(kt.size, k2.length); if (sh > best) { best = sh; twin = o; } }
    if (twin && best >= 0.5) clues.push(`Its answer overlaps a lot with another card (“${esc(shortQ(twin, 60))}”). Mixing them up is likely; try Mix-ups.`);
    const lapsesAfterGood = rv.filter((v, i) => v.g === 1 && i > 0 && rv[i - 1].g >= 3).length;
    if (lapsesAfterGood >= 2) clues.push(`${lapsesAfterGood} times you got it right and then forgot it next time: the knowing feels solid but doesn't last. A memory hook or picture might help.`);
    if (!rv.length) clues.push('No reviews recorded yet on this phone.');
    if (!clues.length) clues.push('Nothing stands out. It may just need time.');
    el.innerHTML = `<div class="lb">${L.top('Card autopsy', '', 'tools')}<button type="button" class="btn lb-wide" data-au="">← Pick another card</button>
      <div class="lb-card l8-q">${esc(x.q).replace(/\n/g, '<br>')}</div><div class="lb-card l8-a">${esc(x.a).replace(/\n/g, '<br>')}</div>
      <div class="l8-stats"><div><b>${rv.length}</b><span>reviews</span></div><div><b>${c.lapses || 0}</b><span>forgot</span></div><div><b>${c.s ? (c.s < 1 ? '<1' : Math.round(c.s)) : '–'}</b><span>stability (days)</span></div><div><b>${r == null ? '–' : pct(r)}</b><span>recall today</span></div></div>
      ${rv.length ? `<div class="lb-card">${timeline(rv)}</div>` : ''}
      <div class="mx-h">Clues</div><div class="lb-card"><ul>${clues.map(s => `<li>${s}</li>`).join('')}</ul></div>
      <p class="lb-foot">Stability and recall come from FSRS-5, the memory model Synapse schedules with. The clues are rules of thumb from the card's text and your timing, not a diagnosis.</p></div>`;
  }
  function timeline(rv) {
    const W = 340, H = 130, t0 = rv[0].t, t1 = Math.max(rv[rv.length - 1].t, t0 + DAY), x = t => 14 + (t - t0) / (t1 - t0) * (W - 28);
    const col = { 1: 'var(--again)', 2: 'var(--hard)', 3: 'var(--good)', 4: 'var(--easy)' }, nm = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
    const ivs = rv.map(v => Math.max(0, v.ivl > 0 ? v.ivl : 0)), mx = Math.max(1, ...ivs), y = d => 96 - Math.sqrt(d / mx) * 80;
    const line = rv.map((v, i) => `${x(v.t).toFixed(1)},${y(ivs[i]).toFixed(1)}`).join(' ');
    const dots = rv.map((v, i) => `<circle cx="${x(v.t).toFixed(1)}" cy="${y(ivs[i]).toFixed(1)}" r="4.5" fill="${col[v.g] || 'var(--mut)'}"><title>${new Date(v.t).toLocaleDateString()} · ${nm[v.g] || ''}</title></circle>`).join('');
    const d0 = new Date(t0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), d1 = new Date(t1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Review history"><polyline points="${line}" fill="none" stroke="var(--line2)" stroke-width="1.5"/>${dots}<text x="14" y="${H - 8}" font-size="10" fill="currentColor" opacity=".6">${d0}</text><text x="${W - 14}" y="${H - 8}" font-size="10" text-anchor="end" fill="currentColor" opacity=".6">${d1}</text><text x="14" y="12" font-size="10" fill="currentColor" opacity=".6">next gap: up to ${mx >= 1 ? Math.round(mx) + 'd' : '<1d'}</text></svg>
      <div class="l8-leg">${[1, 2, 3, 4].map(g => `<span><i style="background:${col[g]}"></i>${nm[g]}</span>`).join('')}</div><p class="muted small">Height = how long Synapse waited before showing it again. Crashes are forgets.</p>`;
  }
  function listA(q) {
    const el = autopsy.el, box = el.querySelector('[data-au-list]'); if (!box) return; q = q.trim().toLowerCase(); if (box.dataset.q === q && box.innerHTML) return; box.dataset.q = q;
    let cs = cards('*', c => !c.susp);
    if (q) cs = cs.filter(c => { const t = qa(c); return (t.q + ' ' + t.a).toLowerCase().includes(q); }).slice(0, 40);
    else cs = cs.filter(c => (c.lapses || 0) > 0 || (c.d || 0) > 6).sort((a, b) => (b.lapses || 0) - (a.lapses || 0) || (b.d || 0) - (a.d || 0)).slice(0, 25);
    box.innerHTML = cs.length ? `<div class="mx-h">${q ? 'Matches' : 'Your toughest cards'}</div><div class="lb-group">${cs.map(c => `<button type="button" class="lb-row" data-au="${esc(c.id)}"><span class="lb-rt"><span class="t1">${esc(shortQ(c))}</span><span class="t2">${c.lapses || 0} forgets · ${(M.decks.get(c.deck) || {}).name || ''}</span></span><span class="lb-chev">${L.ic('chev', 16)}</span></button>`).join('')}</div>` : (q ? empty('No cards match.') : empty('No tough cards yet: nothing has been forgotten. Search above to open any card.'));
  }

  /* ---------- 4. Leech splitter ---------- */
  function parts(a) {
    let p = a.split(/\n+/).map(s => s.replace(/^\s*(?:[-•*·]|\d+[.)])\s*/, '').trim()).filter(Boolean);
    if (p.length < 2) p = a.split(/\s*;\s*/).filter(Boolean);
    if (p.length < 2 && (a.match(/,/g) || []).length >= 2) p = a.split(/\s*,\s*(?:and\s+|or\s+)?|\s+and\s+(?=[^,]*$)/).filter(Boolean);
    p = p.map(s => s.replace(/[.\s]+$/, '').trim()).filter(s => s.length > 1);
    return p.length >= 2 && p.length <= 8 ? p : null;
  }
  const split = { render(el) {
    el.__l8cur = 'split'; split.el = el; split.all = 0;
    mount(el, 'split', async e => {
      if (e.target.closest('[data-sp-all]')) { split.all = 1 - split.all; drawS(); return; }
      const b = e.target.closest('[data-sp]'); if (!b) return; const c = M.cards.get(b.dataset.sp), n = c && M.notes.get(c.nid); if (!c || !n) return;
      const x = qa(c), p = parts(x.a); if (!p) return;
      if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = `Tap again to make ${p.length} cards`; return; }
      const list = [], base = Date.now();
      p.forEach((it, i) => { const note = { id: 'n-' + rid(), created: base + i, deck: c.deck, type: 'basic', front: esc(`${x.q} (${i + 1} of ${p.length})`), back: esc(it) + `<br><span style="opacity:.6">All: ${esc(p.join(' · '))}</span>`, tags: [...(n.tags || []), 'split'] }; M.notes.set(note.id, note); list.push(['notes', note], ...cardsForNote(note, base + i)); });
      list.push(['cards', { ...c, susp: 1 }]); await write(list); toast(`Made ${p.length} cards, original paused`); drawS();
    });
    drawS();
  } };
  function drawS() {
    const el = split.el; const cs = cards('*', c => !c.susp && (split.all || (c.lapses || 0) >= 3)).map(c => ({ c, p: parts(qa(c).a) })).filter(o => o.p).sort((a, b) => (b.c.lapses || 0) - (a.c.lapses || 0)).slice(0, 30);
    el.innerHTML = `<div class="lb">${head('Leech splitter', 'Cards you keep forgetting are often lists crammed into one answer. This breaks them into one small card per item, so one slip stops failing the whole thing.')}
      <div class="lb-seg sm"><button type="button" class="btn${split.all ? '' : ' pri'}" data-sp-all>Leeches (forgot 3+)</button><button type="button" class="btn${split.all ? ' pri' : ''}" data-sp-all>Any list card</button></div>
      ${cs.length ? cs.map(({ c, p }) => `<div class="lb-card"><p class="small muted">${c.lapses || 0} forgets · ${esc((M.decks.get(c.deck) || {}).name || '')}</p><p><b>${esc(shortQ(c, 120))}</b></p><ol class="l8-ol">${p.map(s => `<li>${esc(s)}</li>`).join('')}</ol><button type="button" class="btn pri lb-wide" data-sp="${esc(c.id)}">Split into ${p.length} cards</button></div>`).join('') : empty(split.all ? 'No list-style answers found in your cards.' : 'No leeches with list answers. Nice. Switch to “Any list card” to split others.')}
      <p class="lb-foot">The original card is paused (suspended), not deleted. Unpause it from Browse anytime. Splitting is by line breaks, semicolons or commas, so check the pieces before you tap.</p></div>`;
  }

  /* ---------- 5. Blurt sheet ---------- */
  const BS = store('blurt');
  const blurt = { render(el) {
    el.__l8cur = 'blurt'; blurt.el = el; blurt.run = null; clearInterval(blurt.tk);
    mount(el, 'blurt', async e => {
      const t = e.target.closest('[data-bl]'); if (!t) return; const a = t.dataset.bl;
      if (a === 'go') { const dk = el.querySelector('[data-bl-deck]').value, cs = cards(dk, c => !c.susp && c.ord !== 1 && keyTerms(qa(c).a).length); if (cs.length < 3) { toast('Pick a deck with at least 3 cards'); return; } blurt.run = { dk, ids: cs.slice(0, 300).map(c => c.id), end: Date.now() + 180e3, text: '' }; drawB(); blurt.tk = setInterval(tick, 1000); return; }
      if (a === 'done') { finish(); return; }
      if (a === 'weak') { const n = await sendWeak(blurt.miss || []); toast(n + ' → Weak Spots'); t.textContent = 'Sent ✓'; t.disabled = true; return; }
      if (a === 'again') { blurt.run = null; drawB(); }
    }, e => { if (e.target.matches('[data-bl-txt]') && blurt.run) blurt.run.text = e.target.value; });
    drawB();
  } };
  function tick() { const R = blurt.run, el = blurt.el; if (!R || !el.isConnected) { clearInterval(blurt.tk); return; } const s = Math.max(0, Math.round((R.end - Date.now()) / 1000)), t = el.querySelector('[data-bl-t]'); if (t) t.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); if (!s) finish(); }
  function finish() {
    clearInterval(blurt.tk); const R = blurt.run; if (!R || R.done) return; R.done = 1;
    const said = new Set(words(R.text).map(stem)), hit = [], miss = [];
    for (const id of R.ids) { const c = M.cards.get(id); if (!c) continue; const k = keyTerms(qa(c).a).slice(0, 4); const got = k.filter(w => said.has(w)).length; (got >= Math.max(1, Math.ceil(k.length / 2)) ? hit : miss).push(c); }
    blurt.miss = miss.map(c => c.id); const D = BS.get({ log: [] }); D.log.push({ dk: R.dk, t: Date.now(), hit: hit.length, n: hit.length + miss.length, w: words(R.text).length }); D.log = D.log.slice(-60); BS.set(D);
    const prev = D.log.filter(x => x.dk === R.dk).slice(-2, -1)[0];
    const el = blurt.el; el.innerHTML = `<div class="lb">${head('Blurt sheet', 'Results')}
      <div class="lb-card"><div class="rc-big">${hit.length}/${hit.length + miss.length}</div><p>cards you pulled out of memory with no prompts (${words(R.text).length} words written).${prev ? ` Last time on this deck: ${prev.hit}/${prev.n}.` : ''}</p></div>
      ${hit.length ? `<details class="lb-card"><summary><b>Came out on their own (${hit.length})</b></summary><ul>${hit.slice(0, 40).map(c => `<li>${esc(shortQ(c, 80))}</li>`).join('')}</ul></details>` : ''}
      ${miss.length ? `<div class="mx-h">Didn't come up (${miss.length})</div><div class="lb-card"><ul>${miss.slice(0, 30).map(c => `<li>${esc(shortQ(c, 80))}<br><span class="muted small">${esc(qa(c).a.slice(0, 90))}</span></li>`).join('')}</ul></div><button type="button" class="btn pri lb-wide" data-bl="weak">Send these ${miss.length} to Weak Spots</button>` : ''}
      <button type="button" class="btn lb-wide" data-bl="again">Blurt again</button>
      <p class="lb-foot">Matching is by key words: a card counts if you wrote at least half of its answer's main words (roughly). Free recall with no cues is harder than flashcards, so a low score is normal.</p></div>`;
  }
  function drawB() {
    const el = blurt.el, R = blurt.run;
    if (!R) { el.innerHTML = `<div class="lb">${head('Blurt sheet', 'Pick a deck, then write everything you remember about it in 3 minutes with no cards in front of you. Synapse checks which cards you covered and which never came up.')}<div class="l8-row">${decksSel('data-bl-deck', '*')}<button type="button" class="btn pri" data-bl="go">Start 3:00</button></div></div>`; return; }
    el.innerHTML = `<div class="lb">${L.top('Blurt sheet', '', 'tools')}<div class="l8-timer" data-bl-t>3:00</div><textarea class="l8-ta" data-bl-txt rows="12" placeholder="Everything you know. Messy is fine: keywords, half sentences, lists…"></textarea><button type="button" class="btn pri lb-wide" data-bl="done">I'm done, check it</button></div>`;
    setTimeout(() => { const t = el.querySelector('[data-bl-txt]'); if (t) t.focus(); }, 50);
  }

  /* ---------- 6. Memory palace ---------- */
  const PS = store('palace');
  const ROOMS = ['Front door', 'Hallway', 'Living room', 'Kitchen', 'Stairs', 'Bedroom', 'Bathroom', 'Closet', 'Garage', 'Backyard'];
  const palace = { render(el) {
    el.__l8cur = 'palace'; palace.el = el; palace.mode = 'list'; palace.walk = null;
    mount(el, 'palace', e => {
      const t = e.target.closest('[data-pa]'); if (!t) return; const a = t.dataset.pa, D = PS.get({ p: null });
      if (a === 'build') { const dk = el.querySelector('[data-pa-deck]').value; const cs = cards(dk, c => !c.susp && qa(c).a).sort((x, y) => (y.lapses || 0) - (x.lapses || 0) || (y.d || 0) - (x.d || 0)).slice(0, 10); if (cs.length < 3) { toast('Need at least 3 cards in that deck'); return; } D.p = { dk, rooms: cs.map((c, i) => ({ r: ROOMS[i], id: c.id, img: '' })) }; PS.set(D); palace.mode = 'edit'; drawP(); return; }
      if (a === 'save') { el.querySelectorAll('[data-pa-img]').forEach(i => { D.p.rooms[+i.dataset.paImg].img = i.value.trim(); }); el.querySelectorAll('[data-pa-room]').forEach(i => { D.p.rooms[+i.dataset.paRoom].r = i.value.trim() || ROOMS[+i.dataset.paRoom]; }); PS.set(D); toast('Palace saved'); palace.mode = 'list'; drawP(); return; }
      if (a === 'edit') { palace.mode = 'edit'; drawP(); return; }
      if (a === 'walk') { palace.walk = { i: 0, shown: 0, ok: 0 }; palace.mode = 'walk'; drawP(); return; }
      if (a === 'show') { palace.walk.shown = 1; drawP(); return; }
      if (a === 'ok' || a === 'miss') { if (a === 'ok') palace.walk.ok++; palace.walk.i++; palace.walk.shown = 0; if (palace.walk.i >= D.p.rooms.length) { D.p.best = Math.max(D.p.best || 0, palace.walk.ok); D.p.walks = (D.p.walks || 0) + 1; PS.set(D); } drawP(); return; }
      if (a === 'new') { D.p = null; PS.set(D); palace.mode = 'list'; drawP(); return; }
      if (a === 'back') { palace.mode = 'list'; drawP(); }
    });
    drawP();
  } };
  function drawP() {
    const el = palace.el, D = PS.get({ p: null }), P = D.p; let h = head('Memory palace', 'The method of loci: memory champions park facts in rooms of a place they know, then walk through it. Put your 10 hardest cards in your own house.');
    if (!P) { h += `<div class="lb-card"><p>1. Pick a deck: your 10 hardest cards go one per room.<br>2. For each, write a weird picture that ties the room to the answer.<br>3. Walk the palace: see only the room and recall the card.</p></div><div class="l8-row">${decksSel('data-pa-deck', '*')}<button type="button" class="btn pri" data-pa="build">Build</button></div>`; el.innerHTML = `<div class="lb">${h}</div>`; return; }
    const rooms = P.rooms.filter(r => M.cards.get(r.id));
    if (palace.mode === 'edit') {
      h += P.rooms.map((r, i) => { if (!M.cards.get(r.id)) return ''; const x = qa(M.cards.get(r.id)); return `<div class="lb-card l8-room"><input class="l8-rn" data-pa-room="${i}" value="${esc(r.r)}" aria-label="Room name"><p class="small"><b>${esc(x.q.slice(0, 120))}</b><br><span class="muted">${esc(x.a.slice(0, 120))}</span></p><textarea class="l8-ta sm" data-pa-img="${i}" rows="2" placeholder="Picture it: what weird thing is in this room that shows the answer?">${esc(r.img || '')}</textarea></div>`; }).join('');
      h += `<button type="button" class="btn pri lb-wide" data-pa="save">Save palace</button>`; el.innerHTML = `<div class="lb">${h}</div>`; return;
    }
    if (palace.mode === 'walk') {
      const W = palace.walk;
      if (W.i >= rooms.length) { h += `<div class="lb-card"><div class="rc-big">${W.ok}/${rooms.length}</div><p>rooms recalled. Best walk: ${P.best || W.ok}/${rooms.length}.</p></div><div class="lb-btns"><button type="button" class="btn" data-pa="back">Done</button><button type="button" class="btn pri" data-pa="walk">Walk again</button></div>`; el.innerHTML = `<div class="lb">${h}</div>`; return; }
      const r = rooms[W.i], x = qa(M.cards.get(r.id));
      h += `<div class="l8-walk"><div class="muted small">Room ${W.i + 1} of ${rooms.length}</div><div class="l8-roomname">🚪 ${esc(r.r)}</div>${r.img ? `<p class="l8-img">“${esc(r.img)}”</p>` : '<p class="muted small">(no picture written for this room)</p>'}</div>`;
      h += W.shown ? `<div class="lb-card l8-q">${esc(x.q)}</div><div class="lb-card l8-a">${esc(x.a).replace(/\n/g, '<br>')}</div><div class="lb-btns"><button type="button" class="btn danger" data-pa="miss">Missed</button><button type="button" class="btn pri" data-pa="ok">Got it</button></div>` : `<p class="small">What card lives here? Say it in your head, then check.</p><button type="button" class="btn pri lb-wide" data-pa="show">Show the card</button>`;
      el.innerHTML = `<div class="lb">${h}</div>`; return;
    }
    const filled = rooms.filter(r => r.img).length;
    h += `<div class="lb-card"><h3>Your palace · ${esc((M.decks.get(P.dk) || {}).name || 'All decks')}</h3><p class="small muted">${rooms.length} rooms · ${filled} pictures written${P.walks ? ` · ${P.walks} walks, best ${P.best}/${rooms.length}` : ''}</p><ol class="l8-ol">${rooms.map(r => `<li><b>${esc(r.r)}</b>${r.img ? ' · ' + esc(r.img.slice(0, 50)) : ''}</li>`).join('')}</ol></div>
      <div class="lb-btns"><button type="button" class="btn" data-pa="edit">Edit pictures</button><button type="button" class="btn pri" data-pa="walk">Walk it</button></div><button type="button" class="btn lb-wide" data-pa="new">Build a new palace</button>
      <p class="lb-foot">The method of loci is an old memory technique that memory athletes use; it works best when the pictures are vivid and strange.</p>`;
    el.innerHTML = `<div class="lb">${h}</div>`;
  }

  /* ---------- 7. Sleep on it ---------- */
  const SS = store('sleep');
  const sleep = { render(el) {
    el.__l8cur = 'sleep'; sleep.el = el; sleep.run = null;
    mount(el, 'sleep', e => {
      const t = e.target.closest('[data-sl]'); if (!t) return; const a = t.dataset.sl, D = SS.get({ cur: null, hist: [] });
      if (a === 'night') { const wk = Date.now() - 7 * DAY, fails = new Set(); for (const r of M.revlog.values()) if (r.g === 1 && r.t > wk) fails.add(r.cid); let cs = [...fails].map(id => M.cards.get(id)).filter(c => c && !c.del && !c.susp && qa(c).a); if (cs.length < 10) cs = cs.concat(cards('*', c => !c.susp && c.st >= 2 && !fails.has(c.id) && qa(c).a).sort((x, y) => (recallNow(x) || 1) - (recallNow(y) || 1)).slice(0, 10 - cs.length)); cs = cs.slice(0, 10); if (cs.length < 3) { toast('Study some cards first'); return; } D.cur = { ids: cs.map(c => c.id), nt: Date.now(), night: [], morn: null }; SS.set(D); sleep.run = { k: 'night', i: 0, shown: 0 }; drawZ(); return; }
      if (a === 'morn') { sleep.run = { k: 'morn', i: 0, shown: 0 }; D.cur.morn = []; SS.set(D); drawZ(); return; }
      if (a === 'show') { sleep.run.shown = 1; drawZ(); return; }
      if (a === 'ok' || a === 'miss') { const R = sleep.run; D.cur[R.k].push(a === 'ok' ? 1 : 0); R.i++; R.shown = 0; if (R.k === 'morn' && R.i >= D.cur.ids.length) { D.hist.push({ n: D.cur.ids.length, night: D.cur.night.reduce((s, v) => s + v, 0), morn: D.cur.morn.reduce((s, v) => s + v, 0), nt: D.cur.nt, mt: Date.now() }); D.hist = D.hist.slice(-30); D.done = D.cur; D.cur = null; } SS.set(D); if (R.i >= (D.cur || D.done).ids.length) sleep.run = null; drawZ(); return; }
      if (a === 'drop') { D.cur = null; SS.set(D); drawZ(); }
    });
    drawZ();
  } };
  function drawZ() {
    const el = sleep.el, D = SS.get({ cur: null, hist: [] }), R = sleep.run; let h = head('Sleep on it', 'Study 10 shaky cards right before bed, then test the same 10 when you wake up. Sleep helps lock memories in; this lets you watch it happen with your own cards.');
    if (R) { const ids = (D.cur || D.done).ids, c = M.cards.get(ids[R.i]), x = c ? qa(c) : { q: '?', a: '?' };
      h += `<div class="muted small">${R.k === 'night' ? '🌙 Tonight' : '☀️ Morning test'} · ${R.i + 1}/${ids.length}</div><div class="lb-card l8-q">${esc(x.q).replace(/\n/g, '<br>')}</div>`;
      h += R.shown ? `<div class="lb-card l8-a">${esc(x.a).replace(/\n/g, '<br>')}</div><div class="lb-btns"><button type="button" class="btn danger" data-sl="miss">Missed</button><button type="button" class="btn pri" data-sl="ok">Got it</button></div>` : `<button type="button" class="btn pri lb-wide" data-sl="show">Show answer</button>`;
      el.innerHTML = `<div class="lb">${h}</div>`; return; }
    if (D.cur) { const hrs = (Date.now() - D.cur.nt) / 36e5, sc = D.cur.night.reduce((s, v) => s + v, 0);
      h += `<div class="lb-card"><h3>🌙 ${sc}/${D.cur.ids.length} last night</h3><p>${hrs >= 5 ? 'Good morning. Take the test before you look at these cards anywhere else.' : `Studied ${hrs < 1 ? 'just now' : Math.floor(hrs) + 'h ago'}. Come back after you sleep (the test unlocks after 5 hours).`}</p></div>`;
      h += hrs >= 5 ? `<button type="button" class="btn pri lb-wide" data-sl="morn">Start the morning test</button>` : '';
      h += `<button type="button" class="btn lb-wide" data-sl="drop">Start over</button>`;
    } else h += `<button type="button" class="btn pri lb-wide" data-sl="night">🌙 Tonight's 10</button><p class="muted small">Picks cards you missed this week, then your lowest-recall cards.</p>`;
    if (D.hist.length) h += `<div class="mx-h">Your nights</div><div class="lb-group">${D.hist.slice().reverse().slice(0, 10).map(x => `<div class="lb-row"><span class="lb-rt"><span class="t1">${new Date(x.nt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span><span class="t2">night ${x.night}/${x.n} → morning ${x.morn}/${x.n}</span></span><span class="l8-n">${x.morn - x.night >= 0 ? '+' : ''}${x.morn - x.night}</span></div>`).join('')}</div>`;
    h += `<p class="lb-foot">Sleep's role in memory is well studied, but one night with 10 cards is a tiny sample, so look at the trend over many nights. Doesn't change your review schedule.</p>`;
    el.innerHTML = `<div class="lb">${h}</div>`;
  }

  /* ---------- 8. Patient explainer ---------- */
  const ES = store('explain');
  const JARGON_RX = /(itis|ectomy|otomy|ostomy|plasty|emia|aemia|osis|algia|pathy|penia|cytosis|megaly|ology|ologist|ogenic|oma|scopy|gram|graphy|lysis|trophy|plegia|paresis|rrhea|rrhoea|uria|ptysis|stasis|ase)$|^(hyper|hypo|tachy|brady|dys|neuro|cardio|hepat|nephr|gastr|enter|pulmon|derm|myo|osteo|hemo|haemo|angio|thromb|leuk|erythr|endo|peri|intra|sub|supra|retro|anti|pharmaco|cyto|histo|onco|immuno)[a-z]{4,}/;
  const PLAIN_OK = new Set('heart blood brain lungs lung kidney kidneys liver stomach skin bone bones muscle muscles nerve nerves body cells cell sugar pill pills medicine doctor pain swelling infection fever germs germ virus immune system antibiotic antibiotics therapy history category geology biology hypothesis hyperactive subway subtle intramural anticipate antique period perimeter endorse endless enter entertain stasis'.split(' '));
  function jargon(text, a) {
    const own = new Set(keyTerms(a).filter(w => w.length >= 7));
    return [...new Set(words(text).filter(w => !PLAIN_OK.has(w) && w.length >= 6 && (JARGON_RX.test(w) || own.has(stem(w)) && w.length >= 9)))];
  }
  function syl(w) { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); const m = w.match(/[aeiouy]{1,2}/g); return Math.max(1, m ? m.length : 1); }
  function grade(text) { const sents = Math.max(1, (text.match(/[.!?]+(\s|$)/g) || []).length), ws = words(text); if (ws.length < 8) return null; const sy = ws.reduce((s, w) => s + syl(w), 0); return Math.max(0, 0.39 * (ws.length / sents) + 11.8 * (sy / ws.length) - 15.59); }
  const explain = { render(el) {
    el.__l8cur = 'explain'; explain.el = el; explain.id = null;
    mount(el, 'explain', e => {
      const t = e.target.closest('[data-ex]'); if (!t) return; const a = t.dataset.ex;
      if (a === 'pick') { const cs = cards(el.querySelector('[data-ex-deck]') ? el.querySelector('[data-ex-deck]').value : '*', c => !c.susp && c.ord !== 1 && words(qa(c).a).length >= 2); if (!cs.length) { toast('No cards with answers in that deck'); return; } explain.id = cs[Math.floor(Math.random() * cs.length)].id; drawE(); return; }
      if (a === 'save') { const v = el.querySelector('[data-ex-txt]').value.trim(); if (!v) return; const c = M.cards.get(explain.id), j = jargon(v, qa(c).a), g = grade(v); const D = ES.get({ log: [] }); D.log.push({ id: explain.id, t: Date.now(), j: j.length, g: g == null ? null : Math.round(g * 10) / 10, txt: v.slice(0, 600) }); D.log = D.log.slice(-100); ES.set(D); toast('Saved'); explain.id = null; drawE(); return; }
      if (a === 'back') { explain.id = null; drawE(); }
    }, e => { if (e.target.matches('[data-ex-txt]')) live8(); });
    drawE();
  } };
  function live8() {
    const el = explain.el, ta = el.querySelector('[data-ex-txt]'), out = el.querySelector('[data-ex-live]'); if (!ta || !out) return; const v = ta.value, c = M.cards.get(explain.id); const j = jargon(v, c ? qa(c).a : ''), g = grade(v);
    out.innerHTML = `<div class="l8-stats two"><div><b class="${j.length ? 'bad' : 'ok'}">${j.length}</b><span>jargon words</span></div><div><b class="${g == null ? '' : g <= 8 ? 'ok' : 'bad'}">${g == null ? '–' : 'Grade ' + Math.round(g)}</b><span>reading level</span></div></div>${j.length ? `<p class="small">A patient might not know: ${j.map(w => `<mark class="l8-j">${esc(w)}</mark>`).join(' ')}</p>` : v.length > 20 ? '<p class="small">No jargon spotted. 👍</p>' : ''}`;
  }
  function drawE() {
    const el = explain.el, D = ES.get({ log: [] });
    if (!explain.id) {
      el.innerHTML = `<div class="lb">${head('Patient explainer', 'Doctors have to explain things to patients with no jargon. Get a card, explain it like you’re talking to a 12-year-old patient, and Synapse flags the jargon and your reading level live.')}
        <div class="l8-row">${decksSel('data-ex-deck', '*')}<button type="button" class="btn pri" data-ex="pick">Give me a card</button></div>
        ${D.log.length ? `<div class="mx-h">Your explanations</div><div class="lb-group">${D.log.slice().reverse().slice(0, 12).map(x => { const c = M.cards.get(x.id); return `<div class="lb-row"><span class="lb-rt"><span class="t1">${esc(c ? shortQ(c, 60) : 'Deleted card')}</span><span class="t2">${x.j} jargon · ${x.g == null ? 'too short to grade' : 'grade ' + Math.round(x.g)}</span></span></div>`; }).join('')}</div>` : ''}
        <p class="lb-foot">Jargon spotting is a rule of thumb (medical word parts plus rare words from your own card), so it will miss some and flag a few fine words. Reading level is the Flesch–Kincaid formula; health writing usually aims for grade 8 or lower.</p></div>`; return;
    }
    const c = M.cards.get(explain.id), x = qa(c);
    el.innerHTML = `<div class="lb">${L.top('Patient explainer', '', 'tools')}<div class="lb-card l8-q">${esc(x.q).replace(/\n/g, '<br>')}</div><div class="lb-card l8-a">${esc(x.a).replace(/\n/g, '<br>')}</div>
      <textarea class="l8-ta" data-ex-txt rows="6" placeholder="Explain it to a patient in everyday words…"></textarea><div data-ex-live></div>
      <div class="lb-btns"><button type="button" class="btn" data-ex="back">Skip</button><button type="button" class="btn pri" data-ex="save">Save</button></div></div>`;
  }

  Object.assign(window.LabMods, { stems, conf, autopsy, split, blurt, palace, sleep, explain });
})();
