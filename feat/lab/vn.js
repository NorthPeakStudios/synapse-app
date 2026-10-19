/* Voice notes on cards (#36): record yourself saying the answer (or a memory hook) on any card. Recordings stay ON THIS DEVICE in IndexedDB; they are never uploaded or synced. Max 60 s per note. Open from the study screen ("🎙️ Voice note") or from Study tools to see all of them. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc; L.css2(); L.css3();
  const DB = 'odin-voice', ST = 'notes';
  let dbp = null;
  function db() { return dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => { dbp = null; rej(r.error); }; })); }
  async function tx(mode, fn) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(ST, mode), s = t.objectStore(ST); let out; const q = fn(s); if (q) q.onsuccess = () => { out = q.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); }
  const toBlob = r => { if (r && !r.blob && r.buf) r.blob = new Blob([r.buf], { type: r.type || 'audio/mp4' }); return r; };
  const get = id => tx('readonly', s => s.get(id)).then(toBlob), del = id => tx('readwrite', s => s.delete(id)), all = () => tx('readonly', s => s.getAll()).then(l => (l || []).map(toBlob));
  // Blobs are stored as ArrayBuffers: Safari can refuse Blob values in IndexedDB in some modes
  const put = async o => { const x = Object.assign({}, o); if (x.blob) { x.buf = await x.blob.arrayBuffer(); x.type = x.blob.type; delete x.blob; } return tx('readwrite', s => s.put(x)); };
  const strip = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\{\{c\d+::([\s\S]*?)(::[\s\S]*?)?\}\}/g, '$1').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  function css() { if (document.getElementById('vn-css')) return; const st = document.createElement('style'); st.id = 'vn-css'; st.textContent = `.vn-bg{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9100}.vn-sh{position:fixed;left:0;right:0;bottom:0;z-index:9101;background:var(--bg2,#1c1c1e);color:inherit;border-radius:20px 20px 0 0;padding:18px 18px calc(env(safe-area-inset-bottom,0px) + 18px);box-shadow:0 -10px 30px rgba(0,0,0,.35)}.vn-rec{width:84px;height:84px;border-radius:50%;border:0;background:#ef4444;color:#fff;font-size:30px;display:block;margin:14px auto 8px}.vn-rec.vn-on{animation:vnp 1.2s infinite;border-radius:24px}@keyframes vnp{50%{box-shadow:0 0 0 12px rgba(239,68,68,.25)}}.vn-t{text-align:center;font-variant-numeric:tabular-nums;font-size:18px}.vn-row{display:flex;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(127,127,127,.18)}.vn-row:last-child{border-bottom:0}.vn-q{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`; document.head.appendChild(st); }
  let R = null; // recording state
  function close() { stopRec(true); document.querySelectorAll('.vn-bg,.vn-sh').forEach(x => x.remove()); if (R && R.url) URL.revokeObjectURL(R.url); R = null; }
  function stopRec(discard) { if (!R || !R.mr) return; R.discard = !!discard; try { R.mr.state !== 'inactive' && R.mr.stop(); } catch (e) {} try { R.stream.getTracks().forEach(t => t.stop()); } catch (e) {} clearInterval(R.tm); }
  const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  async function open(card) {
    css(); close(); if (!card) return; const note = M.notes.get(card.nid) || {}; const id = card.nid;
    R = { id, card };
    const bg = document.createElement('div'); bg.className = 'vn-bg'; bg.onclick = close; const sh = document.createElement('div'); sh.className = 'vn-sh'; sh.setAttribute('role', 'dialog');
    document.body.append(bg, sh); R.sh = sh;
    const paint = async () => {
      if (!R || R.sh !== sh) return; const rec = await get(id).catch(() => null); if (R.url) { URL.revokeObjectURL(R.url); R.url = null; } if (rec && rec.blob) R.url = URL.createObjectURL(rec.blob);
      const on = R.mr && R.mr.state === 'recording', supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
      sh.innerHTML = `<div style="display:flex;align-items:center"><b style="flex:1">🎙️ Voice note</b><button class="btn" type="button" data-vn-x>Done</button></div><p class="muted small" style="margin:6px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(strip(note.front).slice(0, 90))}</p>
        ${supported ? `<button class="vn-rec ${on ? 'vn-on' : ''}" type="button" data-vn-rec aria-label="${on ? 'Stop' : 'Record'}">${on ? '■' : '●'}</button><div class="vn-t" data-vn-t>${on ? '0:00 / 1:00' : rec ? 'Recorded ' + fmt(rec.dur || 0) : 'Tap to record (60 s max)'}</div>` : '<p class="muted">Recording isn\'t supported in this browser.</p>'}
        ${rec && !on ? `<audio controls src="${R.url}" style="width:100%;margin-top:10px"></audio><div class="lb-btns"><button class="btn" type="button" data-vn-del>Delete</button></div>` : ''}
        <p class="muted small" style="margin-top:10px">Saved only on this device. Never uploaded.</p>`;
    };
    R.paint = paint;
    sh.addEventListener('click', async e => {
      const t = e.target;
      if (t.closest('[data-vn-x]')) { close(); return; }
      if (t.closest('[data-vn-del]')) { await del(id).catch(() => {}); try { toast('Voice note deleted'); } catch (x) {} mark(); paint(); return; }
      if (t.closest('[data-vn-rec]')) {
        if (R.mr && R.mr.state === 'recording') { stopRec(false); return; }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (x) { return false; } }) || '';
          const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined), chunks = []; R.mr = mr; R.stream = stream; R.t0 = Date.now();
          mr.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
          mr.onstop = async () => { const dur = (Date.now() - R.t0) / 1000; if (!R.discard && chunks.length) { const blob = new Blob(chunks, { type: mr.mimeType || mime || 'audio/webm' }); await put({ id, blob, dur, at: Date.now(), front: strip(note.front).slice(0, 140) }).catch(() => { try { toast('Couldn\'t save on this device'); } catch (x) {} }); try { toast('Voice note saved on this device'); } catch (x) {} mark(); } if (R) { R.mr = null; paint(); } };
          mr.start(); R.tm = setInterval(() => { const s = (Date.now() - R.t0) / 1000; const el = sh.querySelector('[data-vn-t]'); if (el) el.textContent = fmt(s) + ' / 1:00'; if (s >= 60) stopRec(false); }, 250); paint();
        } catch (err) { try { toast('Mic is blocked. Allow the microphone to record.'); } catch (x) {} }
      }
    });
    paint();
  }
  // a small ▶ badge on the study screen when the current card has a note
  async function mark() { try { const c = window.curCard && window.curCard(); const b = document.querySelector('[data-lab-voice]'); if (!c || !b) return; const r = await get(c.nid).catch(() => null); b.textContent = r ? '🎧 Voice note ✓' : '🎙️ Voice note'; } catch (e) {} }
  // Study tools page: every voice note on this device
  async function render(el) {
    css(); el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>'; let list = [];
    try { list = (await all()) || []; } catch (e) {}
    list.sort((a, b) => b.at - a.at);
    const urls = [];
    const h = L.top('Voice notes', list.length ? list.length + ' saved' : '', 'tools') + `<p class="muted lb-p">Record yourself on any card while studying: reveal the answer, then tap 🎙️ Voice note. Recordings stay on this phone only.</p>` +
      (list.length ? `<div class="lb-card">${list.map(r => { const u = URL.createObjectURL(r.blob); urls.push(u); return `<div class="vn-row" style="flex-wrap:wrap"><span class="vn-q">${esc(r.front || 'Card')}</span><span class="muted small">${fmt(r.dur || 0)}</span><button class="btn" type="button" data-vn-rm="${esc(r.id)}" style="min-height:34px;padding:4px 10px">Delete</button><audio controls preload="none" src="${u}" style="width:100%"></audio></div>`; }).join('')}</div>` : '<div class="lb-card"><p class="muted" style="margin:0">No voice notes yet.</p></div>');
    el.innerHTML = `<div class="lb vn">${h}</div>`;
    if (!el.__vn) { el.__vn = 1; el.addEventListener('click', async e => { const b = e.target.closest('[data-vn-rm]'); if (!b) return; await del(b.dataset.vnRm).catch(() => {}); render(el); }); }
  }
  window.LabMods.vn = { open, render, mark, _get: get, _all: all, _put: put };
})();
