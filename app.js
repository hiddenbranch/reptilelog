/* Reptile Log - app UI. Depends on core.js (window.RLCore). */
(function () {
  'use strict';
  const C = window.RLCore;
  const APP_VERSION = '1.3.0';
  const PRO_REQUIRED = false;
  // Licence keys are signed offline and checked on the device. No payment provider, no server, no network call.
  const PUBLIC_KEY = {"kty":"EC","crv":"P-256","x":"REPLACE_WITH_YOUR_PUBLIC_KEY_X","y":"REPLACE_WITH_YOUR_PUBLIC_KEY_Y"};
  const PRODUCT = 'rlog';
  const CDN = { jsqr: 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js', jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js' };

  const $ = (sel, root) => (root || document).querySelector(sel);
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === false || v === null || v === undefined) continue; else if (k === 'value') el.value = v; else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  let toastTimer;
  function toast(msg) { let t = $('.toast'); if (!t) { t = h('div', { class: 'toast' }); document.body.append(t); } t.textContent = msg; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2200); }
  function loadScript(src) { return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.append(s); }); }

  // ---------- IndexedDB ----------
  const DB = {
    db: null,
    open() { if (this.db) return Promise.resolve(this.db); return new Promise((res, rej) => { const r = indexedDB.open('reptilelog', 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('animals', { keyPath: 'id', autoIncrement: true }); const e = d.createObjectStore('entries', { keyPath: 'id', autoIncrement: true }); e.createIndex('animalId', 'animalId'); const p = d.createObjectStore('pages', { keyPath: 'id', autoIncrement: true }); p.createIndex('animalId', 'animalId'); d.createObjectStore('kv', { keyPath: 'key' }); };
      r.onsuccess = () => { this.db = r.result; res(this.db); }; r.onerror = () => rej(r.error); }); },
    tx(store, mode, fn) { return this.open().then(d => new Promise((res, rej) => { const t = d.transaction(store, mode); const req = fn(t.objectStore(store)); t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); })); },
    put(s, o) { return this.tx(s, 'readwrite', st => st.put(o)); }, del(s, id) { return this.tx(s, 'readwrite', st => st.delete(id)); }, get(s, id) { return this.tx(s, 'readonly', st => st.get(id)); }, all(s) { return this.tx(s, 'readonly', st => st.getAll()); },
    byAnimal(s, id) { return this.tx(s, 'readonly', st => st.index('animalId').getAll(id)); },
    async clearAll() { for (const s of ['animals', 'entries', 'pages', 'kv']) await this.tx(s, 'readwrite', st => st.clear()); }
  };
  const S = { cache: {} };
  S.get = async (k, d) => { if (k in S.cache) return S.cache[k]; const r = await DB.get('kv', k); S.cache[k] = r ? r.value : d; return S.cache[k]; };
  S.set = async (k, v) => { S.cache[k] = v; await DB.put('kv', { key: k, value: v }); };

  // ---------- router ----------
  const state = { tab: 'log', sub: null, animalId: null };
  const view = $('#view');
  function go(tab, sub) { state.tab = tab; state.sub = sub || null; render(); window.scrollTo(0, 0); }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(b.dataset.tab); });
  $('#gearBtn').addEventListener('click', () => go('settings'));
  async function render() {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
    view.innerHTML = '';
    const pro = PRO_REQUIRED ? !!(await S.get('pro', false)) : true;
    if (['scan', 'report'].includes(state.tab) && !pro) return view.append(lockScreen());
    await ({ log: renderLog, animals: renderAnimals, scan: renderScan, report: renderReport, ref: renderRef, settings: renderSettings }[state.tab])();
    const chip = $('#jobChip'); const a = state.animalId ? await DB.get('animals', state.animalId) : null; chip.hidden = !a; if (a) chip.textContent = a.name;
  }
  function lockScreen() { return h('div', null, h('h2', null, 'Scan and report'), h('div', { class: 'lock' }, h('p', null, 'Photographing log book pages into the app and sending care reports and sitter handoffs are the paid part of Reptile Log. One-time purchase, no account, nothing leaves your phone.'), h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => go('settings') }, 'Enter a license key')), h('p', { class: 'muted small' }, 'Logging, animals and reference stay free.'))); }

  // ---------- helpers ----------
  const today = C.today;
  async function animalsSorted() { const a = await DB.all('animals'); return a.sort((x, y) => (x.num || 99) - (y.num || 99) || x.name.localeCompare(y.name)); }
  async function currentAnimal(list) { if (state.animalId && list.find(a => a.id === state.animalId)) return list.find(a => a.id === state.animalId); const last = await S.get('lastAnimal', null); const a = list.find(x => x.id === last) || list[0] || null; if (a) state.animalId = a.id; return a; }
  async function lastFeed(animalId) { const es = await DB.byAnimal('entries', animalId); return es.filter(e => e.type === 'feed').sort((a, b) => a.date < b.date ? 1 : -1)[0] || null; }
  function statusBadge(fs) { const label = { overdue: `overdue ${fs.days - 0} d`, due: 'due today', ok: `fed ${fs.days} d ago`, never: 'not fed yet', unknown: `fed ${fs.days} d ago` }[fs.state]; return h('span', { class: 'badge ' + fs.state }, label); }
  function animalChips(list, cur, onPick) { return h('div', { class: 'chips' }, list.map(a => h('button', { class: 'chip' + (a.id === cur ? ' on' : ''), style: 'font-family:inherit', onclick: () => onPick(a) }, `${a.num ? a.num + ' ' : ''}${a.name}`))); }
  function sel(opts, cur) { return h('select', null, opts.map(o => h('option', { value: o, selected: o === cur ? true : false }, o))); }
  function field(label, input) { return h('label', { class: 'field' }, h('span', null, label), input); }
  function fileToCanvas(file, maxDim) { return new Promise((res, rej) => { const url = URL.createObjectURL(file); const img = new Image(); img.onload = () => { const s = Math.min(1, maxDim / Math.max(img.width, img.height)); const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); res(cv); }; img.onerror = () => rej(new Error('Could not read the image')); img.src = url; }); }
  const canvasToBlob = (cv, q) => new Promise(res => cv.toBlob(res, 'image/jpeg', q || 0.8));
  function thumb(blob) { if (!blob) return null; const img = h('img', { class: 'thumb', alt: '' }); img.src = URL.createObjectURL(blob); return img; }


  // ---------- species photos (Wikimedia Commons, cached on the phone) ----------
  const Ph = window.RLPhotos;
  const photoMem = {};
  async function photosEnabled() { return await S.get('photos', true); }
  async function speciesPhoto(sp) {
    if (!sp) return null;
    const key = 'photo:' + sp.name;
    if (key in photoMem) return photoMem[key];
    const cached = await DB.get('kv', key);
    if (cached) { photoMem[key] = cached.value; return cached.value; }
    if (!(await photosEnabled()) || !navigator.onLine) return null;
    let rec = null;
    try {
      let summary = await (await fetch(Ph.SUMMARY_URL(sp.wiki))).json();
      if (!summary || !summary.originalimage) {
        const sr = await (await fetch(Ph.SEARCH_URL(sp.wiki + ' lizard OR snake OR gecko OR tortoise OR turtle OR frog'))).json();
        const hit = sr && sr.query && sr.query.search && sr.query.search[0];
        if (hit) summary = await (await fetch(Ph.SUMMARY_URL(hit.title))).json();
      }
      const file = Ph.fileNameFromUrl(summary && summary.originalimage && summary.originalimage.source);
      if (file) {
        const meta = Ph.parseCommons(await (await fetch(Ph.COMMONS_URL(file))).json(), file);
        if (meta) {
          rec = Object.assign({ article: summary.content_urls && summary.content_urls.desktop ? summary.content_urls.desktop.page : '' }, meta);
          try { const r = await fetch(meta.thumb); if (r.ok) { const blob = await r.blob(); if (blob.size > 0 && blob.size < 1500000) rec.blob = blob; } } catch (e) { /* show by URL instead */ }
        }
      }
    } catch (e) { rec = null; }
    photoMem[key] = rec || false;
    if (rec) await DB.put('kv', { key, value: rec });
    return rec || null;
  }
  function photoImg(rec, cls) {
    if (!rec) return null;
    const img = h('img', { class: cls || 'thumb', alt: '', loading: 'lazy' });
    img.src = rec.blob ? URL.createObjectURL(rec.blob) : rec.thumb;
    return img;
  }
  function photoCredit(rec) {
    if (!rec) return null;
    return h('p', { class: 'muted small', style: 'margin:4px 0 8px' }, Ph.caption(rec).replace(', via Wikimedia Commons', ''), ', ', h('a', { href: rec.page, target: '_blank', rel: 'noopener' }, 'Wikimedia Commons'), rec.licenseUrl ? [' (', h('a', { href: rec.licenseUrl, target: '_blank', rel: 'noopener' }, 'licence'), ')'] : null);
  }
  // fill a placeholder element once the photo arrives, so lists render immediately
  function photoSlot(sp, cls, withCredit) {
    const slot = h('span', { class: 'photo-slot ' + (cls || 'thumb') });
    speciesPhoto(sp).then(rec => { if (!rec) { slot.remove(); return; } slot.replaceWith(withCredit ? h('div', null, photoImg(rec, cls), photoCredit(rec)) : photoImg(rec, cls)); });
    return slot;
  }

  // ---------- log ----------
  async function renderLog() {
    const list = await animalsSorted();
    view.append(h('h2', null, 'Log'));
    if (!list.length) return view.append(h('div', { class: 'empty' }, 'Add your first animal, then logging is two taps.'), h('button', { class: 'btn block', onclick: () => go('animals', 'new') }, 'Add an animal'));
    const a = await currentAnimal(list);
    view.append(animalChips(list, a.id, async x => { state.animalId = x.id; await S.set('lastAnimal', x.id); render(); }));
    const lf = await lastFeed(a.id); const fs = C.feedStatus(lf && lf.date, a.feedInterval, today());
    view.append(h('p', null, statusBadge(fs), a.feedInterval ? h('span', { class: 'muted small' }, `every ${a.feedInterval} d${fs.due ? ', next ' + fs.due : ''}`) : h('span', { class: 'muted small' }, 'set a feeding interval on the profile to get due dates')));
    if (state.sub && ['feed', 'weight', 'shed', 'enclosure', 'health'].includes(state.sub)) return view.append(entryForm(a, state.sub));
    view.append(h('div', { class: 'row' }, h('button', { class: 'btn block', onclick: () => go('log', 'feed') }, 'Feeding'), h('button', { class: 'btn block', onclick: () => go('log', 'weight') }, 'Weight')),
      h('div', { class: 'row3' }, h('button', { class: 'btn secondary block', onclick: () => go('log', 'shed') }, 'Shed'), h('button', { class: 'btn secondary block', onclick: () => go('log', 'enclosure') }, 'Enclosure'), h('button', { class: 'btn secondary block', onclick: () => go('log', 'health') }, 'Health')));
    const es = (await DB.byAnimal('entries', a.id)).sort((x, y) => x.date < y.date ? 1 : x.date > y.date ? -1 : y.id - x.id).slice(0, 30);
    view.append(h('h3', null, 'Recent'));
    if (!es.length) return view.append(h('div', { class: 'empty' }, 'Nothing logged yet for ' + a.name + '.'));
    for (const e of es) view.append(h('div', { class: 'rec' }, thumb(e.photo), h('div', { class: 't' }, h('b', null, `${e.date}  ${{ feed: 'Feeding', weight: 'Weight', shed: 'Shed', enclosure: 'Enclosure', health: 'Health' }[e.type]}`), h('div', { class: 'meta' }, C.entrySummary(e) + (e.note ? ' \u00B7 ' + e.note : ''))), h('button', { class: 'act', onclick: async () => { if (confirm('Delete this entry?')) { await DB.del('entries', e.id); render(); } } }, 'Delete')));
  }
  function entryForm(a, type) {
    const date = h('input', { type: 'date', value: today() }); const note = h('input', { type: 'text', placeholder: 'optional' });
    const photoIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true }); let photoBlob = null;
    const photoBtn = h('button', { class: 'btn secondary block', onclick: () => photoIn.click() }, 'Add a photo');
    photoIn.addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; const cv = await fileToCanvas(f, 1400); photoBlob = await canvasToBlob(cv, 0.75); photoBtn.textContent = 'Photo attached'; e.target.value = ''; });
    let body, collect;
    if (type === 'feed') { const food = h('input', { type: 'text', placeholder: 'small rat, 6 crickets, greens' }), qty = h('input', { type: 'text', placeholder: '45 g, 1, half a cup' }), result = sel(C.FEED_RESULT, 'Took'), supp = sel(C.SUPPLEMENT, 'None'); body = [field('Food', food), h('div', { class: 'row' }, field('Size or quantity', qty), field('Result', result)), field('Supplement', supp)]; collect = () => ({ food: food.value.trim(), qty: qty.value.trim(), result: result.value, supplement: supp.value }); }
    else if (type === 'weight') { const g = h('input', { type: 'number', inputmode: 'decimal', step: 'any', placeholder: 'grams' }); body = [field('Weight (g)', g)]; collect = () => { const v = Number(g.value); if (!(v > 0)) { toast('Enter the weight in grams'); return null; } return { grams: v }; }; }
    else if (type === 'shed') { const result = sel(C.SHED_RESULT, 'Complete'), where = h('input', { type: 'text', placeholder: 'toes, tail tip, eye caps' }), boosted = h('input', { type: 'checkbox' }); body = [field('Result', result), field('Stuck where (if any)', where), h('label', { class: 'field' }, h('span', null, 'Humidity boosted'), boosted)]; collect = () => ({ result: result.value, where: where.value.trim(), boosted: boosted.checked }); }
    else if (type === 'enclosure') { const hot = h('input', { type: 'number', inputmode: 'decimal', placeholder: a.targets && a.targets.hot ? 'target ' + a.targets.hot : '' }), cool = h('input', { type: 'number', inputmode: 'decimal', placeholder: a.targets && a.targets.cool ? 'target ' + a.targets.cool : '' }), bask = h('input', { type: 'number', inputmode: 'decimal', placeholder: a.targets && a.targets.bask ? 'target ' + a.targets.bask : '' }), rh = h('input', { type: 'number', inputmode: 'decimal', placeholder: a.targets && a.targets.rh ? 'target ' + a.targets.rh : '' });
      const cb = {}; const boxes = ['water', 'spot', 'full', 'uvb'].map(k => { cb[k] = h('input', { type: 'checkbox' }); return h('label', { class: 'field' }, h('span', null, { water: 'Water changed', spot: 'Spot cleaned', full: 'Full clean', uvb: 'UVB checked or replaced' }[k]), cb[k]); });
      const flags = h('div');
      const checkAll = () => { flags.innerHTML = ''; const t = a.targets || {};
        [['Hot side', hot, t.hot, 3], ['Cool side', cool, t.cool, 3], ['Basking', bask, t.bask, C.baskingTolerance(t.bask)], ['Humidity', rh, t.rh, 10]].forEach(([label, input, target, tol]) => {
          const r = C.checkReading(input.value, target, tol); if (!r || r.state === 'ok') return;
          flags.append(h('div', { class: 'note' }, `${label} is ${Math.abs(r.delta)} ${label === 'Humidity' ? 'points' : 'degrees'} ${r.state === 'high' ? 'above' : 'below'} the ${target} target for ${a.name}.`)); }); };
      [hot, cool, bask, rh].forEach(i => i.addEventListener('input', checkAll));
      const sp = C.speciesByName(a.species);
      const baskHint = sp && (sp.group === 'Monitor' || (a.targets && Number(a.targets.bask) >= 120))
        ? h('p', { class: 'muted small', style: 'margin:-8px 0 12px' }, 'Basking is the surface temperature under the lamp, read with an infrared gun. Air temperature under the same lamp reads far lower.') : null;
      body = [h('div', { class: 'row' }, field('Hot side (F)', hot), field('Cool side (F)', cool)), h('div', { class: 'row' }, field('Basking (F)', bask), field('Humidity (%)', rh)), baskHint, flags, h('div', { class: 'row' }, boxes)];
      collect = () => ({ hot: hot.value, cool: cool.value, bask: bask.value, rh: rh.value, water: cb.water.checked, spot: cb.spot.checked, full: cb.full.checked, uvb: cb.uvb.checked }); }
    else { const kind = sel(C.HEALTH_TYPE, 'Observation'), text = h('textarea', { placeholder: 'what you saw, where, how long; what you did; dose' }), outcome = sel(['', 'Resolved', 'Ongoing', 'Monitoring', 'Referred'], ''); body = [field('Type', kind), field('Details', text), field('Outcome', outcome)]; collect = () => { if (!text.value.trim()) { toast('Write what you saw'); return null; } return { kind: kind.value, text: text.value.trim(), outcome: outcome.value }; }; }
    return h('div', null, h('h3', null, { feed: 'Feeding', weight: 'Weight', shed: 'Shed', enclosure: 'Enclosure reading', health: 'Health entry' }[type] + ' for ' + a.name), field('Date', date), body, field('Note', note), photoIn, photoBtn,
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => { const data = collect(); if (!data) return; const rec = { animalId: a.id, type, date: date.value || today(), data, note: note.value.trim(), created: Date.now() }; if (photoBlob) rec.photo = photoBlob; await DB.put('entries', rec); toast('Logged'); go('log'); } }, 'Save'), h('button', { class: 'btn secondary', onclick: () => go('log') }, 'Cancel')));
  }

  // ---------- animals ----------
  async function renderAnimals() {
    const list = await animalsSorted();
    if (state.sub === 'new' || (state.sub && state.sub.startsWith('edit:'))) return animalForm(state.sub === 'new' ? null : await DB.get('animals', Number(state.sub.split(':')[1])), list);
    view.append(h('h2', null, 'Animals'), h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => go('animals', 'new') }, 'Add an animal')));
    if (!list.length) return view.append(h('div', { class: 'empty' }, 'No animals yet. Each one gets a number that matches the log book.'));
    for (const a of list) { const lf = await lastFeed(a.id); const fs = C.feedStatus(lf && lf.date, a.feedInterval, today()); view.append(h('div', { class: 'rec' }, photoSlot(C.speciesByName(a.species), 'thumb'), h('div', { class: 't' }, h('b', null, `${a.num ? a.num + '  ' : ''}${a.name}`), h('div', { class: 'meta' }, [a.species, a.morph, a.sex && a.sex !== 'Unknown' ? a.sex : null].filter(Boolean).join(' \u00B7 ')), h('div', { style: 'margin-top:4px' }, statusBadge(fs))), h('button', { class: 'act', onclick: () => go('animals', 'edit:' + a.id) }, 'Edit'))); }
  }
  function animalForm(a, list) {
    const r = a || { num: list.length + 1, name: '', species: '', morph: '', sex: 'Unknown', stage: 'Adult', dob: '', acquired: '', location: '', targets: {}, uvb: 'None', uvbDate: '', feedInterval: 7, diet: '', supplements: '', refusal: '', misting: '', water: '', meds: '', handling: '', donot: '', watch: '', vet: '', notes: '', created: Date.now() };
    const f = {}; const mk = (k, label, type, extra) => { f[k] = h('input', Object.assign({ type: type || 'text', value: r[k] || '' }, extra || {})); return field(label, f[k]); };
    const t = r.targets || {}; const tg = {}; const mkT = (k, label) => { tg[k] = h('input', { type: 'number', inputmode: 'decimal', value: t[k] || '' }); return field(label, tg[k]); };
    const sex = sel(C.SEX, r.sex || 'Unknown'), uvb = sel(['None', 'Low (2 to 5%)', 'Medium (5 to 7%)', 'High (10 to 14%)'], r.uvb || 'None');
    const speciesList = h('datalist', { id: 'speciesList' }, C.SPECIES.map(s => h('option', { value: s.name })));
    f.species = h('input', { type: 'text', value: r.species || '', list: 'speciesList', placeholder: 'start typing, or pick from the list' });
    const stage = sel(['Adult', 'Juvenile'], r.stage || 'Adult');
    const preset = h('div', { class: 'note', hidden: true });
    function applySpecies(force) {
      const sp = C.speciesByName(f.species.value); if (!sp) { preset.hidden = true; return; }
      preset.hidden = false; preset.innerHTML = '';
      const iv = stage.value === 'Juvenile' ? sp.juvInterval : sp.interval;
      preset.append(photoSlot(sp, 'thumb', false), h('b', { style: 'display:block' }, sp.name + ' presets'), h('div', { class: 'small' }, `${sp.warm} / cool ${sp.cool} / ${sp.rh} \u00B7 UVB ${sp.uvb} \u00B7 feed every ${iv} d \u00B7 ${sp.size}, ${sp.life}`),
        h('div', { class: 'small', style: 'margin-top:6px' }, sp.note),
        h('div', { class: 'btns' }, h('button', { class: 'btn secondary', style: 'min-height:38px;font-size:14px', onclick: () => fill(sp, iv) }, 'Use these targets')));
      if (force) fill(sp, iv);
    }
    function fill(sp, iv) {
      tg.hot.value = sp.targets.hot || ''; tg.cool.value = sp.targets.cool || ''; tg.bask.value = sp.targets.bask || ''; tg.rh.value = sp.targets.rh || '';
      f.feedInterval.value = iv; if (!f.diet.value) f.diet.value = sp.diet; if (!f.supplements.value && sp.supp) f.supplements.value = sp.supp;
      if (!f.notes.value && sp.note) f.notes.value = sp.note;
      const u = { 'Optional, low': 'Low (2 to 5%)', 'Required, medium': 'Medium (5 to 7%)', 'Required, high': 'High (10 to 14%)', 'None': 'None' }[sp.uvb]; if (u) uvb.value = u;
      toast('Targets filled from ' + sp.name);
    }
    f.species.addEventListener('change', () => applySpecies(!a));
    f.species.addEventListener('input', () => applySpecies(false));
    stage.addEventListener('change', () => applySpecies(false));
    view.append(h('button', { class: 'back', onclick: () => go('animals') }, '\u2039 Animals'), h('h2', null, a ? 'Edit ' + a.name : 'New animal'), speciesList,
      h('div', { class: 'row' }, mk('num', 'Number (matches the book)', 'number'), mk('name', 'Name')),
      field('Species', f.species), preset, h('div', { class: 'row' }, field('Life stage', stage), mk('morph', 'Morph or locality')), h('div', { class: 'row' }, field('Sex', sex), h('div')),
      h('div', { class: 'row' }, mk('dob', 'Born or hatched', 'date'), mk('acquired', 'Acquired', 'date')), mk('location', 'Enclosure and where it is'),
      h('h3', null, 'Targets'), h('div', { class: 'row' }, mkT('hot', 'Hot side (F)'), mkT('cool', 'Cool side (F)')), h('div', { class: 'row' }, mkT('bask', 'Basking (F)'), mkT('rh', 'Humidity (%)')),
      h('div', { class: 'row' }, field('UVB', uvb), mk('uvbDate', 'UVB installed', 'date')),
      h('h3', null, 'Feeding'), h('div', { class: 'row' }, mk('feedInterval', 'Feed every (days)', 'number', { inputmode: 'numeric' }), mk('supplements', 'Supplement rotation')), mk('diet', 'What and how much'), mk('refusal', 'If it refuses'),
      h('h3', null, 'For a sitter'), mk('water', 'Water routine'), mk('misting', 'Misting'), mk('meds', 'Medication (or none)'), mk('handling', 'Handling'), mk('donot', 'Do not'), mk('watch', 'Call me if'), mk('vet', 'Vet and phone'), mk('notes', 'Notes'),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => { for (const k in f) r[k] = f[k].value.trim(); r.num = Number(r.num) || null; r.feedInterval = Number(r.feedInterval) || null; r.sex = sex.value; r.uvb = uvb.value; r.stage = stage.value; r.targets = Object.fromEntries(Object.keys(tg).map(k => [k, tg[k].value])); if (!r.name) return toast('Give the animal a name'); const id = await DB.put('animals', r); state.animalId = r.id || id; await S.set('lastAnimal', state.animalId); toast(a ? 'Saved' : 'Animal added'); go('animals'); } }, a ? 'Save' : 'Add animal'),
        a ? h('button', { class: 'btn danger', onclick: async () => { if (!confirm('Delete this animal and every log entry?')) return; for (const s of ['entries', 'pages']) { const rows = await DB.byAnimal(s, a.id); for (const x of rows) await DB.del(s, x.id); } await DB.del('animals', a.id); state.animalId = null; go('animals'); } }, 'Delete') : null));
  }

  // ---------- scan ----------
  async function renderScan() {
    const list = await animalsSorted();
    view.append(h('h2', null, 'Scan a log book page'));
    if (!list.length) return view.append(h('div', { class: 'empty' }, 'Add an animal first so pages have somewhere to go.'), h('button', { class: 'btn block', onclick: () => go('animals', 'new') }, 'Add an animal'));
    const a = await currentAnimal(list);
    view.append(animalChips(list, a.id, async x => { state.animalId = x.id; await S.set('lastAnimal', x.id); render(); }));
    const pageIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: e => { if (e.target.files[0]) pageFlow(e.target.files[0], a); e.target.value = ''; } });
    view.append(pageIn, h('button', { class: 'btn block', onclick: () => pageIn.click() }, 'Photograph a page'), h('p', { class: 'muted small' }, 'Fill the frame with the page, flat and straight. The app reads the page code, files the photo under this animal, and includes it in reports. Reading the boxes and bubbles arrives in a later version.'));
    const pages = await DB.byAnimal('pages', a.id);
    if (pages.length) { view.append(h('h3', null, 'Filed pages')); for (const p of pages.sort((x, y) => y.created - x.created)) view.append(h('div', { class: 'rec' }, thumb(p.photo), h('div', { class: 't' }, h('b', null, `${p.templateName}${p.pageNo ? ', page ' + p.pageNo : ''}`), h('div', { class: 'meta' }, new Date(p.created).toLocaleDateString())), h('button', { class: 'act', onclick: async () => { if (confirm('Remove this page?')) { await DB.del('pages', p.id); render(); } } }, 'Remove'))); }
  }
  async function pageFlow(file, a) {
    const cv = await fileToCanvas(file, 1800).catch(err => { toast(err.message); return null; }); if (!cv) return;
    let code = null;
    try { await loadScript(CDN.jsqr); const im = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height); const q = window.jsQR(im.data, im.width, im.height); if (q && /^RLB1\|/.test(q.data)) code = q.data; } catch (e) { /* offline */ }
    const parts = code ? code.split('|') : [];
    const T = { AP: 'Animal profile', FD: 'Feeding log', WT: 'Weight log', SH: 'Shed log', EN: 'Enclosure log', HL: 'Health log', CI: 'Care instructions', SD: 'Sitter daily' };
    const rec = { animalId: a.id, template: parts[1] || '', templateName: T[parts[1]] || 'Page', pageNo: parts[4] || '', created: Date.now(), photo: await canvasToBlob(cv, 0.8) };
    view.innerHTML = '';
    view.append(h('h2', null, code ? `${rec.templateName}${rec.pageNo ? ', page ' + rec.pageNo : ''}` : 'Page photo'), h('img', { class: 'preview', src: cv.toDataURL('image/jpeg', 0.5) }), h('p', { class: 'muted small' }, code ? 'Page code read.' : 'No page code found; filed as a plain page photo.'),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => { await DB.put('pages', rec); toast('Page filed'); go('scan'); } }, 'File under ' + a.name), h('button', { class: 'btn secondary', onclick: () => go('scan') }, 'Cancel')));
  }

  // ---------- report ----------
  async function renderReport() {
    const list = await animalsSorted();
    view.append(h('h2', null, 'Report and handoff'));
    if (!list.length) return view.append(h('div', { class: 'empty' }, 'Add an animal and log something first.'));
    const owner = { name: await S.get('ownerName', ''), phone: await S.get('ownerPhone', ''), vet: await S.get('vet', ''), backup: await S.get('backup', '') };
    const mode = h('select', null, h('option', { value: 'care' }, 'Care report (what happened)'), h('option', { value: 'handoff' }, 'Sitter handoff (what to do)'));
    const days = h('select', null, [14, 30, 90, 365].map(d => h('option', { value: d, selected: d === 30 ? true : false }, `last ${d} days`)));
    const picked = new Set(list.map(a => a.id));
    const chips = h('div', { class: 'chips' }, list.map(a => { const b = h('button', { class: 'chip on', style: 'font-family:inherit', onclick: () => { if (picked.has(a.id)) picked.delete(a.id); else picked.add(a.id); b.classList.toggle('on', picked.has(a.id)); refresh(); } }, a.name); return b; }));
    const pre = h('pre', { class: 'pkg' }); const count = h('p', { class: 'muted small' });
    let pkg = { text: '', files: [], subject: '' };
    async function build() {
      const chosen = list.filter(a => picked.has(a.id)); const d = Number(days.value); const blocks = []; const rows = []; const files = [];
      for (const a of chosen) {
        const es = await DB.byAnimal('entries', a.id);
        if (mode.value === 'care') { blocks.push(C.careReport(a, es, d, today())); es.filter(e => C.daysBetween(e.date, today()) <= d).forEach(e => rows.push({ animal: a.name, date: e.date, type: e.type, summary: C.entrySummary(e), note: e.note || '' })); es.filter(e => e.photo && e.type === 'health' && C.daysBetween(e.date, today()) <= d).forEach((e, i) => files.push(new File([e.photo], `${a.name.replace(/[^\w-]/g, '_')}-${e.date}-health-${i + 1}.jpg`, { type: 'image/jpeg' }))); }
        else { const lf = es.filter(e => e.type === 'feed').sort((x, y) => x.date < y.date ? 1 : -1)[0]; blocks.push(C.sitterHandoff(Object.assign({}, a, { lastFed: lf ? lf.date : '' }), owner)); }
        const pages = await DB.byAnimal('pages', a.id); pages.forEach((p, i) => { if (mode.value === 'care') files.push(new File([p.photo], `${a.name.replace(/[^\w-]/g, '_')}-page-${(p.template || 'photo').toLowerCase()}${p.pageNo ? '-' + p.pageNo : ''}-${i + 1}.jpg`, { type: 'image/jpeg' })); });
      }
      if (mode.value === 'care' && rows.length) files.unshift(new File([C.toCsv(rows.sort((x, y) => x.date < y.date ? 1 : -1), C.ENTRY_COLS)], `reptile-log-${today()}.csv`, { type: 'text/csv' }));
      const subject = mode.value === 'care' ? `Reptile care report, ${chosen.map(a => a.name).join(', ')}, ${today()}` : `Care instructions, ${chosen.map(a => a.name).join(', ')}`;
      return { text: blocks.join('\n\n'), files, subject };
    }
    async function refresh() { pkg = await build(); pre.textContent = pkg.text || 'Pick at least one animal.'; count.textContent = `${pkg.files.length} attachment${pkg.files.length === 1 ? '' : 's'}`; }
    mode.addEventListener('change', refresh); days.addEventListener('change', refresh);
    view.append(h('div', { class: 'row' }, field('What', mode), field('Range', days)), chips, pre, count,
      h('button', { class: 'btn block', onclick: async () => { const data = { title: pkg.subject, text: pkg.text, files: pkg.files }; if (navigator.canShare && navigator.canShare({ files: pkg.files }) && navigator.share) { try { await navigator.share(data); } catch (e) { if (e.name !== 'AbortError') toast('Sharing failed'); } } else if (navigator.share) { try { await navigator.share({ title: pkg.subject, text: pkg.text }); } catch (e) { if (e.name !== 'AbortError') toast('Sharing failed'); } } else toast('This browser cannot share; use copy or download.'); } }, 'Share (Messages, Mail, WhatsApp)'),
      h('button', { class: 'btn secondary block', onclick: async () => { try { await navigator.clipboard.writeText(`${pkg.subject}\n\n${pkg.text}`); toast('Copied'); } catch (e) { toast('Copy failed; select the text instead'); } } }, 'Copy text'),
      h('button', { class: 'btn secondary block', onclick: async () => { try { await loadScript(CDN.jszip); const z = new window.JSZip(); z.file('report.txt', `${pkg.subject}\n\n${pkg.text}`); pkg.files.forEach(f => z.file(f.name, f)); const blob = await z.generateAsync({ type: 'blob' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `reptile-log-${today()}.zip`; document.body.append(a); a.click(); a.remove(); } catch (e) { toast('Zip needs a connection the first time'); } } }, 'Download everything as a .zip'),
      h('p', { class: 'muted small' }, 'The care report is for you, a vet, or an owner checking on a sitter. The handoff is what you send the sitter before you leave, built from each animal\'s profile.'));
    refresh();
  }

  // ---------- reference ----------
  const TOOLS = [
    { id: 'temp', title: 'Fahrenheit and Celsius', fields: [{ key: 'f', label: 'Fahrenheit', value: 90 }, { key: 'c', label: 'Celsius', value: 28 }], compute: v => [{ l: `${v.f} F`, v: `${C.fToC(v.f)} C` }, { l: `${v.c} C`, v: `${C.cToF(v.c)} F` }] },
    { id: 'mass', title: 'Grams and ounces', fields: [{ key: 'g', label: 'Grams', value: 1200 }, { key: 'oz', label: 'Ounces', value: 4 }], compute: v => [{ l: `${v.g} g`, v: `${C.gToOz(v.g)} oz` }, { l: `${v.oz} oz`, v: `${C.ozToG(v.oz)} g` }] },
    { id: 'prey', title: 'Prey size for a snake', fields: [{ key: 'body', label: 'Snake weight (g)', value: 1200 }, { key: 'prey', label: 'Prey weight (g)', value: 120 }, { key: 'pct', label: 'Target percent of body weight', value: 12 }], compute: v => [{ l: 'This prey is', v: `${C.preyPercent(v.prey, v.body)}% of body weight`, n: '10 to 15% is the common range for adults', tone: C.preyPercent(v.prey, v.body) > 15 ? 'bad' : '' }, { l: `Prey at ${v.pct}%`, v: `${C.preyForPercent(v.body, v.pct)} g` }] },
    { id: 'due', title: 'Next feeding date', fields: [{ key: 'last', label: 'Last fed (YYYY-MM-DD)', value: today(), type: 'text' }, { key: 'int', label: 'Interval (days)', value: 12 }], compute: v => [{ l: 'Next feeding', v: C.addDays(v.last, Number(v.int)) }, { l: 'Days since', v: `${C.daysBetween(v.last, today())}` }] }
  ];
  const REFS = [
    { id: 'species', title: 'Species guide', species: true },
    { id: 'signs', title: 'Signs to watch', cols: ['What you see', 'Often points to', 'What to do'], rows: C.SIGNS },
    { id: 'emergency', title: 'Emergency list', bullets: C.EMERGENCY, intro: 'Call the vet now, and the owner if you are the sitter.' },
    { id: 'feeding', title: 'Feeding and supplements', bullets: C.FEEDING_NOTES },
    { id: 'prey', title: 'Prey weights', cols: ['Prey', 'Typical weight'], rows: C.PREY },
    { id: 'quarantine', title: 'Quarantine', bullets: C.QUARANTINE },
    { id: 'sitter', title: 'If you are the sitter', bullets: C.SITTER }
  ];
  const toolVals = {};
  async function renderRef() {
    if (state.sub && state.sub.startsWith('tool:')) {
      const t = TOOLS.find(x => x.id === state.sub.slice(5)); const vals = toolVals[t.id] || (toolVals[t.id] = Object.fromEntries(t.fields.map(f => [f.key, f.value])));
      const readout = h('div', { class: 'readout' });
      const update = () => { readout.innerHTML = ''; const v = {}; for (const f of t.fields) v[f.key] = f.type === 'text' ? vals[f.key] : Number(vals[f.key]); let res; try { res = t.compute(v); } catch (e) { res = [{ l: 'Check the inputs', v: '-', tone: 'bad' }]; } for (const r of res) readout.append(h('div', { class: 'line ' + (r.tone || '') }, h('span', { class: 'l' }, r.l, r.n ? h('span', { class: 'n' }, r.n) : null), h('span', { class: 'v' }, r.v))); };
      view.append(h('button', { class: 'back', onclick: () => go('ref') }, '\u2039 Reference'), h('h2', null, t.title), readout, t.fields.map(f => field(f.label, h('input', { type: f.type === 'text' ? 'text' : 'number', inputmode: f.type === 'text' ? 'text' : 'decimal', step: 'any', value: vals[f.key], oninput: e => { vals[f.key] = e.target.value; update(); } }))));
      update(); return;
    }
    if (state.sub === 'species') {
      view.append(h('button', { class: 'back', onclick: () => go('ref') }, '\u2039 Reference'), h('h2', null, 'Species guide'));
      const q = h('input', { type: 'search', placeholder: `search ${C.SPECIES.length} species` }); const groupSel = sel(['All'].concat(C.speciesGroups()), 'All');
      const out = h('div');
      const draw = () => { out.innerHTML = '';
        const list = C.searchSpecies(q.value).filter(s => groupSel.value === 'All' || s.group === groupSel.value);
        if (!list.length) return out.append(h('div', { class: 'empty' }, 'No species match that. Try the group filter, or the common name.'));
        for (const s of list) out.append(h('details', { class: 'plat' }, h('summary', null, photoSlot(s, 'thumb sm'), h('span', { style: 'margin-left:10px' }, s.name)), h('div', { class: 'body' },
          photoSlot(s, 'photo', true),
          h('div', { class: 'tablewrap' }, h('table', { class: 'ref' }, h('tbody', null,
            [['Group', s.group], ['Warm / basking', s.warm + ' F'], ['Cool side', s.cool + ' F'], ['Night', s.night ? s.night + ' F' : 'n/a'], ['Humidity', s.rh + (s.rhShed ? ', ' + s.rhShed + '% in shed' : '')], ['UVB', s.uvb],
             ['Feeding, adult', 'every ' + s.interval + ' day' + (s.interval === 1 ? '' : 's')], ['Feeding, juvenile', 'every ' + s.juvInterval + ' day' + (s.juvInterval === 1 ? '' : 's')], ['Diet', s.diet], ['Supplements', s.supp], ['Adult size', s.size], ['Lifespan', s.life]]
              .map(row => h('tr', null, h('th', { style: 'width:34%' }, row[0]), h('td', null, row[1])))))),
          h('p', { style: 'margin-top:8px' }, s.note)))); };
      q.addEventListener('input', draw); groupSel.addEventListener('change', draw);
      view.append(h('div', { class: 'row' }, field('Search', q), field('Group', groupSel)), out,
        h('p', { class: 'muted small' }, 'Commonly published husbandry guidance for healthy animals, not veterinary advice. A current species care guide and a reptile vet outrank this screen.'));
      draw(); return;
    }
    if (state.sub) {
      const r = REFS.find(x => x.id === state.sub); if (!r) return go('ref');
      view.append(h('button', { class: 'back', onclick: () => go('ref') }, '\u2039 Reference'), h('h2', null, r.title));
      if (r.intro) view.append(h('p', { class: 'muted' }, r.intro));
      if (r.rows) view.append(h('div', { class: 'tablewrap' }, h('table', { class: 'ref' }, h('thead', null, h('tr', null, r.cols.map(c => h('th', null, c)))), h('tbody', null, r.rows.map(row => h('tr', null, row.map(c => h('td', null, c))))))));
      if (r.bullets) view.append(h('ul', null, r.bullets.map(b => h('li', { style: 'margin:0 0 10px' }, b))));
      view.append(h('p', { class: 'muted small' }, 'Commonly published husbandry guidance, not veterinary advice. A species care guide and a reptile vet outrank this screen.'));
      return;
    }
    view.append(h('h2', null, 'Reference'), h('h3', null, 'Tools'), h('ul', { class: 'list' }, TOOLS.map(t => h('li', null, h('button', { onclick: () => go('ref', 'tool:' + t.id) }, h('span', { class: 't' }, h('b', null, t.title)), h('span', { class: 'k' }, '\u203A'))))),
      h('h3', null, 'Tables'), h('ul', { class: 'list' }, REFS.map(r => h('li', null, h('button', { onclick: () => go('ref', r.id) }, h('span', { class: 't' }, h('b', null, r.title)), h('span', { class: 'k' }, '\u203A'))))));
  }

  // ---------- settings ----------
  async function renderSettings() {
    if (state.sub === 'credits') {
      const all = (await DB.all('kv')).filter(r => String(r.key).startsWith('photo:') && r.value);
      view.append(h('button', { class: 'back', onclick: () => go('settings') }, '\u2039 Settings'), h('h2', null, 'Photo credits'));
      if (!all.length) return view.append(h('div', { class: 'empty' }, 'No photos loaded yet. Open a species in the Reference tab.'));
      for (const r of all.sort((x, y) => x.key.localeCompare(y.key))) view.append(h('div', { class: 'rec' }, photoImg(r.value, 'thumb'), h('div', { class: 't' }, h('b', null, r.key.slice(6)), photoCredit(r.value))));
      return;
    }
    const f = {}; const mk = async (k, label, type) => { f[k] = h('input', { type: type || 'text', value: await S.get(k, '') }); return field(label, f[k]); };
    const key = h('input', { type: 'text', class: 'mono', value: await S.get('licenseKey', '') });
    view.append(h('h2', null, 'Settings'), h('h3', null, 'Owner details (go on the sitter handoff)'), await mk('ownerName', 'Your name'), await mk('ownerPhone', 'Your phone', 'tel'), await mk('vet', 'Vet and after-hours vet'), await mk('backup', 'If the sitter cannot reach you'),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => { for (const k in f) await S.set(k, f[k].value.trim()); toast('Saved'); } }, 'Save')),
      h('h3', null, PRO_REQUIRED ? 'License' : 'License (not required in this build)'), field('License key', key),
      h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: async () => { const k = key.value.trim(); if (!k) return toast('Paste the key first');
        const r = await window.License.verify(k, PUBLIC_KEY, PRODUCT);
        if (r.valid) { await S.set('pro', true); await S.set('licenseKey', k); toast('Licence active'); go('settings'); } else toast(r.reason); } }, 'Activate')),
      h('h3', null, 'Species photos'),
      h('p', { class: 'muted small' }, 'Photos come from Wikimedia Commons the first time you open a species, then stay on the phone. Only free-licence images are shown, each with its author and licence.'),
      h('label', { class: 'field' }, h('span', null, 'Load species photos (uses data once per species)'), (() => { const cb = h('input', { type: 'checkbox' }); photosEnabled().then(v => { cb.checked = !!v; }); cb.addEventListener('change', async () => { await S.set('photos', cb.checked); toast(cb.checked ? 'Photos on' : 'Photos off'); }); return cb; })()),
      h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: () => go('settings', 'credits') }, 'Photo credits'), h('button', { class: 'btn secondary', onclick: async () => { const all = await DB.all('kv'); for (const r of all) if (String(r.key).startsWith('photo:')) await DB.del('kv', r.key); for (const k in photoMem) delete photoMem[k]; toast('Photo cache cleared'); } }, 'Clear photo cache')),
      h('h3', null, 'Sharing with a sitter (coming)'), h('p', { class: 'muted small' }, 'A later version adds accounts: you invite a sitter, they log from their own phone against your animals, and you see each day\'s entries as they happen. Until then, the handoff text and the daily book pages do the job.'),
      h('h3', null, 'Install on your phone'), h('p', { class: 'muted small' }, 'iPhone: Safari, Share, Add to Home Screen. Android: the Install button at the top, or the browser menu. Works without a connection once installed.'),
      h('h3', null, 'Your data'), h('p', { class: 'muted small' }, 'Animals, entries and photos live in this browser on this phone. Nothing is uploaded until you share it.'),
      h('div', { class: 'btns' }, h('button', { class: 'btn danger', onclick: async () => { if (confirm('Delete every animal, entry and photo on this phone?')) { await DB.clearAll(); S.cache = {}; state.animalId = null; toast('Cleared'); go('log'); } } }, 'Delete all data')),
      h('p', { class: 'muted small' }, `Reptile Log ${APP_VERSION}`));
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('#installBtn').hidden = false; });
  $('#installBtn').addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#installBtn').hidden = true; });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  render();
})();
