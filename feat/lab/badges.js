/* Badges + levels: XP levels (from the shared Hub store) and 30 Doctor Lab / study-tool badges (the app-wide achievements in Stats stay as they are) tied to real actions across the app. Badges are computed from synced data (Hub days, Lab scores, cards); the moment each was earned is saved in the synced progress record lab:badges. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc; L.css2(); L.css3();
  const KEY = 'badges.v1';
  let E = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } })();
  function saveE() { E.at = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(E)); } catch (e) {} try { if (typeof write === 'function' && M.progress) write([['progress', { id: 'lab:badges', t: 'lab', data: E, at: E.at, del: 0 }]]); } catch (e) {} }
  function pullE() { try { const o = M.progress && M.progress.get('lab:badges'); if (o && o.data) { let ch = false; for (const [k, v] of Object.entries(o.data)) if (k !== 'at' && (!E[k] || v < E[k])) { E[k] = v; ch = true; } if (ch) localStorage.setItem(KEY, JSON.stringify(E)); } } catch (e) {} }
  function stats() {
    const H = window.Hub ? Hub._S() : { days: {} }, c = {}; let goalDays = 0; const goal = (H.goal || 50);
    for (const d of Object.values(H.days || {})) { for (const [k, v] of Object.entries(d.c || {})) c[k] = (c[k] || 0) + v; if ((d.xp || 0) >= goal) goalDays++; }
    const sc = (L._S().sc) || {}; const lv = window.Hub ? Hub.level() : { level: 1 };
    const best = (src, min) => Object.values(sc[src] || {}).filter(x => x.b >= min).length;
    let notes = 0; try { for (const n of M.notes.values()) if (!n.del) notes++; } catch (e) {}
    let pipe = 0; try { pipe = (JSON.parse(localStorage.getItem('druglab.v1') || '{}').list || []).length; } catch (e) {}
    const cnt = src => Object.values(sc[src] || {}).reduce((a, x) => a + (x.n || 0), 0);
    return { c, cnt, goalDays, lv: lv.level, streak: window.Hub ? Math.max(Hub.best(), Hub.streak()) : 0, best, mods: Object.keys(sc).filter(k => Object.keys(sc[k]).length).length, notes, pipe };
  }
  const B = [
    ['sim5', '🏥', 'On the wards', 'Finish 5 patient sims', s => [s.cnt('sim'), 5]],
    ['lesion', '🎯', 'Lesion hunter', 'Score 80%+ on 10 lesion cases', s => [s.best('lesion', 80), 10]],
    ['neuro', '🧠', 'Localiser', 'Score 80%+ on 5 neuro exam patients', s => [s.best('neuro', 80), 5]],
    ['neuroall', '🧑‍⚕️', 'Neurologist', 'Examine all 16 neuro patients', s => [s.best('neuro', 0), 16]],
    ['code', '⚡', 'Code leader', 'Run a code blue perfectly', s => [s.best('code', 100), 1]],
    ['codeall', '🚑', 'Crash cart', 'Score 80%+ on all 6 codes', s => [s.best('code', 80), 6]],
    ['surg', '🔪', 'Scrubbed in', 'Perfect order on 5 surgeries', s => [s.best('surg', 100), 5]],
    ['surgall', '🏨', 'Chief resident', 'Score 80%+ on all 12 surgeries', s => [s.best('surg', 80), 12]],
    ['atlas', '🗺️', 'Brain mapper', 'Score 90%+ on the brain atlas quiz', s => [s.best('atlas', 90), 1]],
    ['atlas100', '🧭', 'Neuroanatomist', 'Perfect brain atlas quiz', s => [s.best('atlas', 100), 1]],
    ['ecg', '📈', 'Rhythm reader', 'Score 80%+ on 3 ECG rounds', s => [s.best('ecg', 80), 3]],
    ['scan', '🩻', 'Radiologist', 'Score 80%+ on 5 scan cases', s => [s.best('scan', 80), 5]],
    ['labs', '🧫', 'Lab rat', 'Score 80%+ on 10 lab panels', s => [s.best('labs', 80), 10]],
    ['ddx', '📋', 'Differential', 'Score 80%+ on 5 differential cases', s => [s.best('ddx', 80), 5]],
    ['words', '🔤', 'Word nerd', 'Score 80%+ on 5 word builder rounds', s => [s.best('words', 80), 5]],
    ['receptor', '🔑', 'Lock + key', 'Score 80%+ on 3 receptor rounds', s => [s.best('receptor', 80), 3]],
    ['history', '📜', 'Historian', 'Perfect medicine timeline', s => [s.best('history', 100), 1]],
    ['heart', '❤️', 'Good ears', 'Score 80%+ on a heart sounds quiz', s => [s.best('heart', 80), 1]],
    ['lung', '🫁', 'Deep breath', 'Score 80%+ on a lung sounds quiz', s => [s.best('lung', 80), 1]],
    ['inst', '🛠️', 'Instrument nurse', 'Score 80%+ on instrument ID', s => [s.best('inst', 80), 1]],
    ['derm', '🔍', 'Skin detective', 'Score 80%+ on the rash quiz', s => [s.best('derm', 80), 1]],
    ['histo', '🔬', 'Microscopist', 'Score 80%+ on histology slides', s => [s.best('histo', 80), 1]],
    ['drug', '🧪', 'Drug designer', 'Take a drug through Drug Lab trials', s => [s.pipe, 1]],
    ['drug5', '🏭', 'Pipeline', 'Design 5 drugs in Drug Lab', s => [s.pipe, 5]],
    ['match', '💊', 'Pharmacist', 'Score 80%+ on 5 drug matcher rounds', s => [s.best('match', 80), 5]],
    ['dle10', '🩺', 'Rounds regular', 'Solve 10 doctordle 6-clue rounds', s => [s.best('dle', 1), 10]],
    ['dleone', '🎯', 'One clue wonder', 'Solve a 6-clue round on the first guess', s => [s.best('dle', 100), 1]],
    ['lab10', '🧬', 'Explorer', 'Try 10 different Doctor Lab games', s => [s.mods, 10]],
    ['lab20', '🏆', 'Completionist', 'Try 20 different Doctor Lab games', s => [s.mods, 20]],
    ['focus', '⏱️', 'Deep focus', 'Finish 10 focus blocks', s => [s.c.focus || 0, 10]]
  ];
  function compute() { pullE(); const s = stats(); const out = B.map(([id, em, t, d, f]) => { const [v, need] = f(s); return { id, em, t, d, v: Math.min(v, need), need, got: v >= need }; }); let fresh = []; for (const b of out) if (b.got && !E[b.id]) { E[b.id] = Date.now(); fresh.push(b); } if (fresh.length) saveE(); return { list: out, fresh }; }
  let busy = 0;
  function watch() { if (watch.on) return; watch.on = 1; const chk = () => { clearTimeout(busy); busy = setTimeout(() => { const r = compute(); if (r.fresh.length && !watch.first) for (const b of r.fresh.slice(0, 2)) try { toast(b.em + ' Badge unlocked: ' + b.t); } catch (e) {} watch.first = 0; }, 1200); }; watch.first = 1; chk(); try { Hub.onChange(chk); } catch (e) {} }
  let S = null;
  function render(el) { S = { el }; paint(); }
  function paint() {
    if (!S || !S.el.isConnected) return; const r = compute(), lv = window.Hub ? Hub.level() : { level: 1, xp: 0, into: 0, need: 50, pct: 0 };
    const n = r.list.filter(b => b.got).length;
    let h = L.top('Badges + levels', n + '/' + r.list.length, 'tools');
    h += `<div class="bd-lv"><div class="bd-ring" style="--p:${lv.pct}"><b>${lv.level}</b><small>level</small></div><div><div class="bd-xp">${lv.xp.toLocaleString()} XP</div><div class="muted small">${(lv.need - lv.into).toLocaleString()} XP to level ${lv.level + 1}</div><div class="bd-bar"><i style="width:${lv.pct}%"></i></div></div></div>`;
    h += `<div class="bd-grid">${r.list.map(b => `<div class="bd${b.got ? ' got' : ''}"><div class="bd-em">${b.em}</div><b>${esc(b.t)}</b><span>${esc(b.d)}</span>${b.got ? `<small>${E[b.id] ? new Date(E[b.id]).toLocaleDateString() : ''}</small>` : `<div class="bd-pb"><i style="width:${Math.round(100 * b.v / b.need)}%"></i></div><small>${b.v.toLocaleString()} / ${b.need.toLocaleString()}</small>`}</div>`).join('')}</div>`;
    let app = ''; try { if (window.Stats2 && Stats2.count) { const c = Stats2.count(); app = typeof c === 'object' ? (c.unlocked != null ? c.unlocked + '/' + c.total : '') : String(c); } } catch (e) {}
    h += `<p class="muted small" style="text-align:center;margin-top:12px">These are Doctor Lab + study tool badges.${app ? ' Your app-wide achievements (' + esc(app) + ') are in Stats.' : ' App-wide achievements (cards, Learn, streaks) are in Stats.'}</p>`;
    S.el.innerHTML = `<div class="lb">${h}</div>`;
  }
  window.LabMods.badges = { render, compute, watch, B };
})();
