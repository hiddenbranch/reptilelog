/* Reptile Log - core: pure functions and reference data. No DOM. */
(function (root) {
  'use strict';
  const C = {};
  const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100;
  C.round = { r1, r2 };
  C.fToC = f => r1((f - 32) * 5 / 9);
  C.cToF = c => r1(c * 9 / 5 + 32);
  C.gToOz = g => r2(g / 28.3495);
  C.ozToG = oz => r1(oz * 28.3495);
  C.preyPercent = (preyG, bodyG) => bodyG ? r1(preyG / bodyG * 100) : null;
  C.preyForPercent = (bodyG, pct) => r1(bodyG * pct / 100);
  C.DAY = 86400000;
  C.daysBetween = (a, b) => Math.floor((new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0)) / C.DAY);
  C.addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  C.today = () => new Date().toISOString().slice(0, 10);
  // feeding status from the last offering and the animal's interval
  C.feedStatus = function (lastFedDate, intervalDays, today) {
    if (!lastFedDate) return { state: 'never', days: null, due: null };
    const days = C.daysBetween(lastFedDate, today || C.today());
    const due = C.addDays(lastFedDate, intervalDays || 7);
    if (!intervalDays) return { state: 'unknown', days, due: null };
    if (days > intervalDays) return { state: 'overdue', days, due };
    if (days === intervalDays) return { state: 'due', days, due };
    return { state: 'ok', days, due };
  };
  // weight trend: percent change between the earliest and latest weight in the window
  C.weightTrend = function (weights, days, today) {
    const t = today || C.today();
    const w = weights.filter(x => C.daysBetween(x.date, t) <= days && x.grams > 0).sort((a, b) => a.date < b.date ? -1 : 1);
    if (w.length < 2) return null;
    const first = w[0].grams, last = w[w.length - 1].grams;
    return { first, last, pct: r1((last - first) / first * 100), n: w.length, from: w[0].date, to: w[w.length - 1].date };
  };
  C.FEED_RESULT = ['Took', 'Refused', 'Partial'];
  C.SUPPLEMENT = ['None', 'Ca', 'Ca+D3', 'MV', 'Ca + MV'];
  C.SHED_RESULT = ['Complete', 'Partial', 'Stuck'];
  C.HEALTH_TYPE = ['Observation', 'Treatment', 'Vet visit', 'Medication', 'Resolved'];
  C.SEX = ['Unknown', 'Male', 'Female'];

  // ---------- reference ----------
  // Species data lives in species.js (43 entries with targets, diet, supplements and notes).
  C.SPECIES = (typeof module !== 'undefined' && module.exports) ? require('./species.js') : (root.RLSpecies || []);
  C.speciesByName = name => C.SPECIES.find(s => s.name === name) || null;
  C.speciesGroups = () => [...new Set(C.SPECIES.map(s => s.group))];
  C.searchSpecies = function (q) {
    const t = String(q || '').trim().toLowerCase();
    if (!t) return C.SPECIES;
    return C.SPECIES.filter(s => s.name.toLowerCase().includes(t) || s.group.toLowerCase().includes(t));
  };
  // compare a logged reading against the animal's target; tolerance in degrees / percent
  C.checkReading = function (value, target, tol) {
    const v = Number(value), t = Number(target);
    if (!v || !t) return null;
    const d = v - t;
    if (Math.abs(d) <= (tol || 3)) return { state: 'ok', delta: r1(d) };
    return { state: d > 0 ? 'high' : 'low', delta: r1(d) };
  };
  // A 5 degree window is sensible on an 88F warm side and meaningless on a 155F basking surface.
  C.baskingTolerance = t => Math.max(5, Math.round(Number(t) * 0.08));
  C.PREY = [['Pinky mouse', '1 to 3 g'], ['Fuzzy mouse', '3 to 6 g'], ['Hopper mouse', '6 to 10 g'], ['Adult mouse', '18 to 30 g'], ['Jumbo mouse', '30 to 45 g'], ['Rat pup', '5 to 10 g'], ['Weaned rat', '15 to 30 g'], ['Small rat', '30 to 60 g'], ['Medium rat', '60 to 120 g'], ['Large rat', '120 to 200 g']];
  C.SIGNS = [
    ['Wheezing, bubbles at nose or mouth, open-mouth breathing', 'Respiratory infection', 'Check temperatures and humidity, then a vet within days.'],
    ['Soft or swollen jaw, bowed limbs, tremors', 'Metabolic bone disease', 'Vet. Fix UVB and supplements after the vet has seen the animal.'],
    ['Retained shed on toes, tail tip or eye caps', 'Low humidity, dehydration', 'Humid hide or warm soak; never pull dry shed. Vet if circulation looks cut off.'],
    ['Tiny black or red dots moving, constant soaking', 'Mites', 'Quarantine, treat per vet advice, clean everything, check other animals.'],
    ['Refusing food beyond its pattern, with weight loss', 'Stress, temperature, illness, season', 'Check the setup first. Log weights. Vet if loss passes about 10%.'],
    ['Regurgitation after a meal', 'Handled too soon, prey too large, too cold, illness', 'Wait 10 to 14 days, then smaller prey. Twice in a row: vet.'],
    ['Lethargy with sunken eyes or wrinkled skin', 'Dehydration', 'Water, soak, humidity. Vet if no improvement within a day.'],
    ['Runny, foul or bloody stool, or none for far too long', 'Parasites, impaction', 'Fecal test at the vet; straining or swelling is an emergency.']
  ];
  C.EMERGENCY = ['Prolapse (tissue protruding from the vent); keep it moist on the way', 'Bleeding that does not stop, deep wounds, burns from a heat source', 'Seizures, twitching, inability to right itself, limp or unresponsive', 'Straining to pass stool or eggs for hours, or a swollen abdomen', 'Open-mouth breathing that does not stop when the animal calms down', 'Heat failed cold or thermostat failed hot: very cold and unresponsive, or overheated and gaping'];
  C.FEEDING_NOTES = ['Snakes: prey about the width of the thickest part of the body, or 10 to 15% of body weight. Smaller and more often beats a struggle.', 'Hatchlings every 5 to 7 days; sub-adults 7 to 10; adult ball pythons 10 to 14 (some 2 to 3 weeks); adult boas 2 to 4 weeks.', 'Thaw fully, warm in a bag in warm water, never microwave. Offer with tongs at dusk, then leave the animal alone for 48 hours.', 'Insect eaters: insect no longer than the space between the eyes; gut-load 24 hours; remove uneaten crickets.', 'Common supplement rotation: calcium (no D3) most feedings, calcium with D3 once or twice a week without UVB, multivitamin every 1 to 2 weeks.'];
  C.QUARANTINE = ['Separate room, 60 to 90 days, own tools and water bowl; handle last, wash between.', 'Paper towel substrate to see mites and stool; a fecal test before joining the collection.', 'Weekly weights; stable or rising weight and two clean sheds are the usual release criteria.'];
  C.SITTER = ['Work from the care instructions in the listed order. Do not improvise on feeding; a skipped meal is safer than a wrong one.', 'Check temperatures with the thermometer in the enclosure, not the thermostat display. More than about 5 degrees off and you cannot fix it: call the owner.', 'Log as you go, not from memory afterward; send the day\'s log to the owner each evening.', 'Never let anyone else handle the animals, never feed live prey unless it is written down, never take an animal outside.'];

  // ---------- csv and reports ----------
  C.csvEscape = v => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  C.toCsv = (rows, cols) => [cols.map(c => C.csvEscape(c.label)).join(',')].concat(rows.map(r => cols.map(c => C.csvEscape(typeof c.key === 'function' ? c.key(r) : r[c.key])).join(','))).join('\n');
  C.ENTRY_COLS = [{ key: 'animal', label: 'Animal' }, { key: 'date', label: 'Date' }, { key: 'type', label: 'Type' }, { key: 'summary', label: 'Entry' }, { key: 'note', label: 'Note' }];
  C.entrySummary = function (e) {
    const d = e.data || {};
    switch (e.type) {
      case 'feed': return `${d.food || 'food'}${d.qty ? ' ' + d.qty : ''}: ${d.result || ''}${d.supplement && d.supplement !== 'None' ? ', ' + d.supplement : ''}`;
      case 'weight': return `${d.grams} g`;
      case 'shed': return `${d.result || ''}${d.where ? ', stuck: ' + d.where : ''}`;
      case 'enclosure': return [d.hot ? 'hot ' + d.hot : null, d.cool ? 'cool ' + d.cool : null, d.bask ? 'bask ' + d.bask : null, d.rh ? 'RH ' + d.rh + '%' : null, d.water ? 'water' : null, d.spot ? 'spot clean' : null, d.full ? 'full clean' : null, d.uvb ? 'UVB' : null].filter(Boolean).join(', ');
      case 'health': return `${d.kind || ''}: ${d.text || ''}${d.outcome ? ' (' + d.outcome + ')' : ''}`;
      default: return '';
    }
  };
  C.careReport = function (animal, entries, days, today) {
    const t = today || C.today();
    const es = entries.filter(e => C.daysBetween(e.date, t) <= days).sort((a, b) => a.date < b.date ? 1 : -1);
    const feeds = es.filter(e => e.type === 'feed'), weights = es.filter(e => e.type === 'weight'), sheds = es.filter(e => e.type === 'shed'), health = es.filter(e => e.type === 'health'), enc = es.filter(e => e.type === 'enclosure');
    const lines = [`${animal.name}${animal.species ? ' (' + animal.species + ')' : ''}, last ${days} days to ${t}`];
    const fs = C.feedStatus(feeds[0] && feeds[0].date, animal.feedInterval, t);
    lines.push(`Feedings: ${feeds.length} offered, ${feeds.filter(f => (f.data || {}).result === 'Refused').length} refused. Last: ${feeds[0] ? feeds[0].date + ' ' + C.entrySummary(feeds[0]) : 'none'}${fs.due ? '. Next due ' + fs.due : ''}`);
    const trend = C.weightTrend(weights.map(w => ({ date: w.date, grams: Number((w.data || {}).grams) })), days, t);
    lines.push(`Weight: ${weights[0] ? weights[0].data.grams + ' g on ' + weights[0].date : 'no weights'}${trend ? ` (${trend.pct > 0 ? '+' : ''}${trend.pct}% over ${trend.n} weighings since ${trend.from})` : ''}`);
    lines.push(`Sheds: ${sheds.length}${sheds[0] ? ', last ' + sheds[0].date + ' ' + C.entrySummary(sheds[0]) : ''}`);
    if (enc[0]) lines.push(`Last enclosure reading ${enc[0].date}: ${C.entrySummary(enc[0])}`);
    if (health.length) { lines.push('Health:'); health.forEach(h => lines.push(`- ${h.date} ${C.entrySummary(h)}`)); }
    return lines.join('\n');
  };
  C.sitterHandoff = function (animal, owner) {
    const a = animal, tg = a.targets || {};
    const L = [`CARE INSTRUCTIONS: ${a.name}${a.species ? ' (' + a.species + ')' : ''}`];
    if (a.location) L.push(`Where: ${a.location}`);
    if (a.feedInterval) L.push(`Feed every ${a.feedInterval} day${a.feedInterval === 1 ? '' : 's'}${a.lastFed ? '; last fed ' + a.lastFed + ', next due ' + C.addDays(a.lastFed, a.feedInterval) : ''}`);
    if (a.diet) L.push(`What and how much: ${a.diet}`);
    if (a.supplements) L.push(`Supplements: ${a.supplements}`);
    if (a.refusal) L.push(`If refused: ${a.refusal}`);
    const temps = [tg.hot ? 'hot side ' + tg.hot + 'F' : null, tg.cool ? 'cool side ' + tg.cool + 'F' : null, tg.bask ? 'basking ' + tg.bask + 'F' : null, tg.rh ? 'humidity ' + tg.rh + '%' : null].filter(Boolean).join(', ');
    if (temps) L.push(`Should read: ${temps}`);
    if (a.misting) L.push(`Misting: ${a.misting}`);
    if (a.water) L.push(`Water: ${a.water}`);
    if (a.meds) L.push(`Medication: ${a.meds}`);
    L.push(`Handling: ${a.handling || 'not needed; leave the animal alone'}`);
    if (a.donot) L.push(`DO NOT: ${a.donot}`);
    if (a.watch) L.push(`Call me if: ${a.watch}`);
    if (owner && (owner.name || owner.phone)) L.push(`Owner: ${[owner.name, owner.phone].filter(Boolean).join(' ')}`);
    if (a.vet || (owner && owner.vet)) L.push(`Vet: ${a.vet || owner.vet}`);
    if (owner && owner.backup) L.push(`If you cannot reach me: ${owner.backup}`);
    return L.join('\n');
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = C; else root.RLCore = C;
})(typeof window !== 'undefined' ? window : globalThis);
