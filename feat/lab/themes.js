/* Custom themes (#39): mode, any accent color, background tint, app font, card font and text size, with a live preview. Save your combos as "My themes" (synced with your settings) or start from a preset. Everything is stored in Settings. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc; L.css2(); L.css3();
  let S = null;
  const PRE = [['Neuro', { theme: 'dark', accent: '#bf5af2', tint: 'grape', uiFont: 'system' }], ['Ocean', { theme: 'dark', accent: '#40c8e0', tint: 'ocean', uiFont: 'system' }], ['Forest', { theme: 'dark', accent: '#30d158', tint: 'forest', uiFont: 'rounded' }], ['Sunset', { theme: 'dark', accent: '#ff9f0a', tint: 'sunset', uiFont: 'rounded' }], ['Clinic', { theme: 'light', accent: '#0a84ff', tint: 'slate', uiFont: 'system' }], ['Midnight', { theme: 'amoled', accent: '#0a84ff', tint: 'none', uiFont: 'system' }], ['Notebook', { theme: 'light', accent: '#ff375f', tint: 'rose', uiFont: 'serif' }]];
  const TN = { none: 'None', ocean: 'Ocean', forest: 'Forest', grape: 'Grape', sunset: 'Sunset', rose: 'Rose', slate: 'Slate' };
  const FN = { system: 'System', rounded: 'Rounded', serif: 'Serif', mono: 'Mono' };
  const P = () => Prefs.v;
  function render(el) { S = { el, name: '' }; if (!el.__th) { el.__th = 1; el.addEventListener('click', onClick); el.addEventListener('input', onInput); el.addEventListener('change', onInput); } paint(); }
  function chips(attr, list, cur) { return `<div class="at-tabs" style="flex-wrap:wrap">${list.map(([k, n]) => `<button type="button" ${attr}="${k}" class="${cur === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>`; }
  function swatch(t) { const T = Prefs.TINTS[t.tint], dark = t.theme !== 'light'; const bg = T && t.theme !== 'amoled' ? T[dark ? 0 : 1][0] : t.theme === 'amoled' ? '#000' : dark ? '#0c0c0e' : '#f2f2f7', card = T && t.theme !== 'amoled' ? T[dark ? 0 : 1][2] : dark ? '#1c1c1f' : '#fff'; return `<span style="display:inline-flex;width:44px;height:30px;border-radius:9px;background:${bg};align-items:center;justify-content:center;border:1px solid rgba(127,127,127,.3)"><span style="width:26px;height:14px;border-radius:5px;background:${card};display:flex;align-items:center;justify-content:center"><span style="width:12px;height:6px;border-radius:3px;background:${t.accent}"></span></span></span>`; }
  function paint() {
    if (!S || !S.el.isConnected) return; const v = P();
    let h = L.top('Themes', '', 'tools') + `<p class="muted lb-p">Make the app yours. Changes apply right away and sync with your settings.</p>`;
    h += `<div class="lb-card" style="padding:14px"><div class="muted small">Preview</div><div style="font-family:var(--card-font);font-size:20px;margin:8px 0 6px">Der Hippocampus</div><div class="muted">memory formation · temporal lobe</div><div class="lb-btns" style="margin-top:10px"><button class="btn" type="button" tabindex="-1">Again</button><button class="btn pri" type="button" tabindex="-1">Good</button></div></div>`;
    h += `<h3>Presets</h3><div class="lb-group">${PRE.map(([n, t], i) => `<button class="lb-row" type="button" data-th-pre="${i}">${swatch(t)}<span class="lb-rt" style="margin-left:10px"><span class="t1">${n}</span><span class="t2">${t.theme} · ${TN[t.tint]} · ${FN[t.uiFont]}</span></span></button>`).join('')}</div>`;
    h += `<h3>Mode</h3>` + chips('data-th-mode', [['dark', 'Dark'], ['light', 'Light'], ['amoled', 'Black'], ['auto', 'Auto']], v.theme);
    h += `<h3>Accent</h3><div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">${Prefs.ACCENTS.map(([n, c]) => `<button type="button" data-th-acc="${c}" aria-label="${n}" style="width:34px;height:34px;border-radius:50%;background:${c};border:${v.accent.toLowerCase() === c.toLowerCase() ? '3px solid var(--tx,#fff)' : '2px solid transparent'}"></button>`).join('')}<label style="display:flex;align-items:center;gap:6px" class="muted small">Any color <input type="color" data-th-any value="${esc(v.accent)}" style="width:44px;height:34px;border:0;background:none;padding:0"></label></div>`;
    h += `<h3>Background tint</h3>` + chips('data-th-tint', Object.entries(TN), v.tint || 'none') + (v.theme === 'amoled' ? '<p class="muted small">Black mode stays pure black, tints show in Dark and Light.</p>' : '');
    h += `<h3>App font</h3>` + chips('data-th-font', Object.entries(FN), v.uiFont || 'system');
    h += `<h3>Card font</h3>` + chips('data-th-cfont', Object.entries(FN), v.cards.font || 'system');
    h += `<h3>Text size</h3>` + chips('data-th-text', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large'], ['xl', 'Huge']], v.text);
    const my = v.myThemes || [];
    h += `<h3>My themes</h3>${my.length ? `<div class="lb-group">${my.map((t, i) => `<div class="lb-row" style="cursor:default">${swatch(t)}<span class="lb-rt" style="margin-left:10px"><span class="t1">${esc(t.name)}</span><span class="t2">${t.theme} · ${TN[t.tint] || 'None'} · ${FN[t.uiFont] || 'System'}</span></span><button class="btn pri" type="button" data-th-use="${i}" style="min-height:34px;padding:4px 10px">Use</button><button class="btn" type="button" data-th-del="${i}" style="min-height:34px;padding:4px 10px;margin-left:6px">✕</button></div>`).join('')}</div>` : '<p class="muted small">Save the look you have now to switch back to it anytime.</p>'}
      <div style="display:flex;gap:8px;margin-top:8px"><input data-th-name maxlength="24" placeholder="Name this theme" value="${esc(S.name)}" style="flex:1;min-width:0;font-size:16px;padding:10px;border-radius:12px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit"><button class="btn pri" type="button" data-th-save ${my.length >= 8 ? 'disabled' : ''}>Save</button></div>`;
    h += `<div class="lb-btns" style="margin-top:18px"><button class="btn" type="button" data-th-reset>Reset look to default</button></div>`;
    const y = window.scrollY; S.el.innerHTML = `<div class="lb th">${h}</div>`; window.scrollTo(0, y);
  }
  function applyT(t) { ['theme', 'accent', 'tint', 'uiFont'].forEach(k => { if (t[k] != null) Prefs.set(k, t[k]); }); if (t.cardFont) Prefs.set('cards.font', t.cardFont); }
  function onInput(e) {
    const t = e.target;
    if (t.matches('[data-th-any]') && /^#[0-9a-f]{6}$/i.test(t.value)) { Prefs.set('accent', t.value); if (e.type === 'change') paint(); return; }
    if (t.matches('[data-th-name]')) S.name = t.value;
  }
  function onClick(e) {
    if (!S) return; const t = e.target; let b;
    if ((b = t.closest('[data-th-pre]'))) { applyT(PRE[+b.dataset.thPre][1]); try { toast(PRE[+b.dataset.thPre][0] + ' theme on'); } catch (x) {} paint(); return; }
    if ((b = t.closest('[data-th-mode]'))) { Prefs.set('theme', b.dataset.thMode); paint(); return; }
    if ((b = t.closest('[data-th-acc]'))) { Prefs.set('accent', b.dataset.thAcc); paint(); return; }
    if ((b = t.closest('[data-th-tint]'))) { Prefs.set('tint', b.dataset.thTint); paint(); return; }
    if ((b = t.closest('[data-th-font]'))) { Prefs.set('uiFont', b.dataset.thFont); paint(); return; }
    if ((b = t.closest('[data-th-cfont]'))) { Prefs.set('cards.font', b.dataset.thCfont); paint(); return; }
    if ((b = t.closest('[data-th-text]'))) { Prefs.set('text', b.dataset.thText); paint(); return; }
    if ((b = t.closest('[data-th-use]'))) { applyT(P().myThemes[+b.dataset.thUse]); paint(); return; }
    if ((b = t.closest('[data-th-del]'))) { const my = (P().myThemes || []).slice(); my.splice(+b.dataset.thDel, 1); Prefs.set('myThemes', my); paint(); return; }
    if (t.closest('[data-th-save]')) { const v = P(), name = (S.name || '').trim().slice(0, 24) || 'My theme ' + ((v.myThemes || []).length + 1); const my = (v.myThemes || []).slice(); my.push({ name, theme: v.theme, accent: v.accent, tint: v.tint || 'none', uiFont: v.uiFont || 'system', cardFont: v.cards.font || 'system' }); Prefs.set('myThemes', my.slice(0, 8)); S.name = ''; try { toast('Saved “' + name + '”'); } catch (x) {} paint(); return; }
    if (t.closest('[data-th-reset]')) { applyT({ theme: 'dark', accent: '#0a84ff', tint: 'none', uiFont: 'system', cardFont: 'system' }); Prefs.set('text', 'm'); paint(); }
  }
  window.LabMods.themes = { render, _S: () => S };
})();
