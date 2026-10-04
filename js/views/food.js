// Lebensmittel hinzufügen: eine Suche für Datenbank, eigene Lebensmittel,
// Gerichte, Favoriten und Open Food Facts; dazu Menge wählen, Einträge
// bearbeiten, Schnelleintrag und Barcode.

import {
  store, ui, C, S, $, esc, fmt, num, icon, actions, inputs, forms, openSheet, setSheet, closeSheet, commit, save, toast, haptic,
  avatar, nutriGrid, mealOptions, defaultMeal, rememberFood, addEntry, amountLabel, currentWeight,
} from '../core.js';
import { FOODS, CATEGORIES, searchFoods } from '../foods.js';
import { burnEquivalents } from '../insights.js';
import { prefFlags } from './prefs.js';

const fs = { meal: 'breakfast', query: '', cat: null, item: null, amount: 100, editing: null, online: [], onlineFor: '' };

const mealLabel = (id) => S.MEALS.find((m) => m.id === id)?.label || 'Mahlzeit';
const allFoods = () => [...store.state.customFoods, ...FOODS];
const isFav = (id) => store.state.favorites.some((f) => f.id === id);

function findFood(id) {
  const s = store.state;
  return allFoods().find((f) => f.id === id) || s.favorites.find((f) => f.id === id) || s.recentFoods.find((f) => f.id === id) || fs.online.find((f) => f.id === id);
}

// ---------- Suche ----------

export function openAdd(meal) {
  Object.assign(fs, { meal: meal || defaultMeal(), query: '', cat: null, item: null, editing: null });
  openSheet(`${mealLabel(fs.meal)} hinzufügen`, searchHtml());
  renderResults();
  setTimeout(() => $('#add-search')?.focus({ preventScroll: true }), 250);
}

function searchHtml() {
  return `
    <label class="search-box">${icon('search')}<input id="add-search" type="search" placeholder="Lebensmittel, Marke oder Gericht" autocomplete="off" enterkeyhint="search" aria-label="Suchen" value="${esc(fs.query)}"></label>
    <div class="tool-row">
      <button class="tool t-orange" data-action="ai-open" data-mode="photo" data-meal="${fs.meal}"><i aria-hidden="true">📸</i><span>Foto-KI</span></button>
      <button class="tool t-violet" data-action="ai-open" data-mode="text" data-meal="${fs.meal}"><i aria-hidden="true">✨</i><span>Beschreiben</span></button>
      <button class="tool t-blue" data-action="add-barcode"><i aria-hidden="true">🏷️</i><span>Barcode</span></button>
      <button class="tool t-green" data-action="add-quick"><i aria-hidden="true">⚡</i><span>Nur kcal</span></button>
    </div>
    <div id="add-results" class="add-results"></div>`;
}

function prefTag(name) {
  const p = prefFlags(name);
  return p.disliked ? ' <span class="pref-badge pref-no">🚫 isst du nicht</span>' : p.liked ? ' <span class="pref-badge pref-yes">😋</span>' : '';
}

function foodRow(f) {
  const portion = f.portion && f.portionLabel ? ` · 1 ${esc(f.portionLabel)} = ${fmt(f.portion)} g` : '';
  return `<li><button class="row" data-action="pick-food" data-id="${esc(f.id)}">
    ${avatar(f.name, null, f.category)}
    <span class="row-main"><b>${esc(f.name)}${prefTag(f.name)}${isFav(f.id) ? ` <span class="fav-dot" aria-label="Favorit">${icon('star')}</span>` : ''}</b><small>${f.brand ? `${esc(f.brand)} · ` : ''}${fmt(f.kcal)} kcal / 100 g${portion}</small></span>
    <span class="row-add" aria-hidden="true">${icon('plus')}</span>
  </button></li>`;
}

function dishCardMini(d) {
  const t = C.dishTotals(d);
  return `<button class="dish-mini" data-action="pick-dish" data-id="${d.id}">
    ${avatar(d.name, d.photo)}
    <b>${esc(d.name)}</b>
    <small>${fmt(t.perServing.kcal)} kcal / Portion</small>
  </button>`;
}

function renderResults() {
  const box = $('#add-results');
  if (!box) return;
  const s = store.state;
  const q = fs.query.trim();
  let html = '';
  const dishes = [...s.dishes].sort((a, b) => (b.uses || 0) - (a.uses || 0));

  if (!q) {
    if (dishes.length) {
      html += `<section><h4 class="eyebrow">🍲 Meine Gerichte</h4><div class="hscroll">${dishes.slice(0, 12).map(dishCardMini).join('')}</div></section>`;
    }
    if (s.favorites.length) html += `<section><h4 class="eyebrow">⭐ Favoriten</h4><ul class="rows">${s.favorites.map(foodRow).join('')}</ul></section>`;
    const recents = s.recentFoods.filter((r) => !isFav(r.id)).slice(0, 8);
    if (recents.length) html += `<section><h4 class="eyebrow">🕘 Zuletzt verwendet</h4><ul class="rows">${recents.map(foodRow).join('')}</ul></section>`;
    let list = allFoods();
    if (fs.cat) list = list.filter((f) => f.category === fs.cat);
    html += `<section><h4 class="eyebrow">🧺 Stöbern</h4>
      <div class="chips">${CATEGORIES.map((c) => `<button class="chip" data-action="add-cat" data-id="${esc(c)}" aria-pressed="${fs.cat === c}">${esc(c)}</button>`).join('')}</div>
      <ul class="rows">${list.slice(0, fs.cat ? 80 : 25).map(foodRow).join('')}</ul></section>`;
  } else {
    const dm = dishes.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()));
    if (dm.length) html += `<section><h4 class="eyebrow">🍲 Meine Gerichte</h4><div class="hscroll">${dm.map(dishCardMini).join('')}</div></section>`;
    const list = searchFoods(allFoods(), q);
    html += list.length
      ? `<section><h4 class="eyebrow">${list.length} Treffer</h4><ul class="rows">${list.slice(0, 40).map(foodRow).join('')}</ul></section>`
      : `<p class="empty-note">Nichts in der Datenbank gefunden.</p>`;
    html += `<section id="online-section">${
      fs.onlineFor === q && fs.online.length
        ? `<h4 class="eyebrow">Online (Open Food Facts)</h4><ul class="rows">${fs.online.map(foodRow).join('')}</ul>`
        : `<button class="btn btn-soft btn-block" data-action="add-online">${icon('search')}Online nach „${esc(q)}“ suchen</button>`
    }</section>`;
  }
  html += `<div class="add-foot">
    <button class="btn btn-ghost btn-block" data-action="add-custom">${icon('pen')}Eigenes Lebensmittel anlegen</button>
  </div>`;
  box.innerHTML = html;
}

inputs['add-search'] = (el) => {
  fs.query = el.value;
  renderResults();
};

actions['open-add'] = (d) => openAdd(d.meal);
actions['add-cat'] = (d) => {
  fs.cat = fs.cat === d.id ? null : d.id;
  renderResults();
};

// ---------- Menge wählen ----------

function amountHtml() {
  const it = fs.item;
  const n = C.scaleBase(it.base, fs.amount, it.unit);
  const chips = it.unit === 'portion'
    ? [0.5, 1, 1.5, 2].map((v) => [v, `${fmt(v, 1)} ${v === 1 ? 'Portion' : 'Port.'}`])
    : [
        ...(it.portion && it.portion !== 100 ? [[it.portion, `1 ${it.portionLabel || 'Portion'}`]] : []),
        [100, '100 g'],
        ...(it.portion ? [[Math.round(it.portion * 2), `2× ${it.portionLabel || 'Portion'}`]] : []),
        ...(it.portion ? [[Math.round(it.portion / 2), `½ ${it.portionLabel || 'Portion'}`]] : []),
      ];
  return `
    <div class="pick-head">
      ${avatar(it.name, it.photo, it.category)}
      <div class="row-main"><b class="pick-name">${esc(it.name)}</b><small>${it.brand ? `${esc(it.brand)} · ` : ''}${
        it.unit === 'portion' ? `${fmt(it.base.kcal)} kcal pro Portion` : `${fmt(it.base.kcal)} kcal pro 100 g`
      }</small></div>
      ${it.foodId && !fs.editing ? `<button class="icon-btn fav-btn" data-action="toggle-fav" aria-pressed="${isFav(it.foodId)}" aria-label="Als Favorit merken">${icon('star')}</button>` : ''}
    </div>
    <div class="chips">${chips.map(([v, l]) => `<button class="chip" data-action="set-amount" data-v="${v}" aria-pressed="${fs.amount === v}">${esc(l)}</button>`).join('')}</div>
    <div class="stepper">
      <button class="step-btn" data-action="step-amount" data-dir="-1" aria-label="Weniger">${icon('minus')}</button>
      <label class="step-field"><input id="amount-input" type="number" inputmode="decimal" min="0" step="any" value="${fs.amount}" aria-label="Menge"><span>${it.unit === 'portion' ? 'Portionen' : 'Gramm'}</span></label>
      <button class="step-btn" data-action="step-amount" data-dir="1" aria-label="Mehr">${icon('plus')}</button>
    </div>
    <div id="amount-nutri">${nutriGrid(n, true)}</div>
    <div class="burn" id="amount-burn">${burnHtml(n.kcal)}</div>
    <label class="field">Mahlzeit<select id="amount-meal">${mealOptions(fs.meal)}</select></label>
    <div class="sheet-actions">
      ${fs.editing
        ? `<button class="btn btn-ghost btn-danger-text" data-action="entry-delete">${icon('trash')}Löschen</button>
           <button class="btn btn-primary" data-action="amount-save">Speichern</button>`
        : `<button class="btn btn-ghost" data-action="amount-back">Zurück</button>
           <button class="btn btn-primary" data-action="amount-save" id="amount-save">Hinzufügen · ${fmt(n.kcal)} kcal</button>`}
    </div>`;
}

function burnHtml(kcal) {
  if (kcal < 5) return '';
  return `<p class="burn-title">🔥 So lange müsstest du dafür …</p>
    <div class="burn-row">${burnEquivalents(kcal, currentWeight())
      .map((b) => `<span class="burn-item"><i aria-hidden="true">${b.emoji}</i><b>${b.minutes} Min.</b><small>${b.label}</small></span>`)
      .join('')}</div>`;
}

function showAmount() {
  setSheet(fs.editing ? 'Eintrag bearbeiten' : `${mealLabel(fs.meal)} hinzufügen`, amountHtml());
}

function refreshAmount() {
  const n = C.scaleBase(fs.item.base, fs.amount, fs.item.unit);
  $('#amount-nutri').innerHTML = nutriGrid(n, true);
  $('#amount-burn').innerHTML = burnHtml(n.kcal);
  const btn = $('#amount-save');
  if (btn) btn.textContent = `Hinzufügen · ${fmt(n.kcal)} kcal`;
  document.querySelectorAll('[data-action="set-amount"]').forEach((c) => c.setAttribute('aria-pressed', Number(c.dataset.v) === fs.amount));
}

export function pickFood(f, meal) {
  if (meal) {
    fs.meal = meal;
    fs.editing = null;
  }
  fs.item = { foodId: f.id, name: f.name, brand: f.brand || '', category: f.category, unit: 'g', portion: f.portion, portionLabel: f.portionLabel, base: { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat }, food: f };
  fs.amount = f.portion || 100;
  if (document.querySelector('#sheet').open) showAmount();
  else openSheet(`${mealLabel(fs.meal)} hinzufügen`, amountHtml());
}

export function pickDish(dish, meal) {
  if (meal) fs.meal = meal;
  const t = C.dishTotals(dish);
  fs.item = { dishId: dish.id, name: dish.name, unit: 'portion', photo: dish.photo, base: t.perServing };
  fs.amount = 1;
  fs.editing = null;
  if (document.querySelector('#sheet').open) showAmount();
  else openSheet(`${mealLabel(fs.meal)} hinzufügen`, amountHtml());
}

actions['pick-food'] = (d) => {
  const f = findFood(d.id);
  if (f) pickFood(f);
};
actions['pick-dish'] = (d) => {
  const dish = store.state.dishes.find((x) => x.id === d.id);
  if (dish) pickDish(dish);
};
actions['set-amount'] = (d) => {
  fs.amount = Number(d.v);
  $('#amount-input').value = fs.amount;
  refreshAmount();
};
actions['step-amount'] = (d) => {
  const step = fs.item.unit === 'portion' ? 0.5 : fs.amount >= 100 ? 25 : 10;
  fs.amount = Math.max(0, Math.round((fs.amount + step * Number(d.dir)) * 10) / 10);
  $('#amount-input').value = fs.amount;
  refreshAmount();
  haptic(6);
};
inputs['amount-input'] = (el) => {
  fs.amount = num(el.value);
  refreshAmount();
};
actions['amount-back'] = () => {
  setSheet(`${mealLabel(fs.meal)} hinzufügen`, searchHtml());
  renderResults();
};
actions['toggle-fav'] = (d, btn) => {
  const s = store.state;
  const f = fs.item.food || findFood(fs.item.foodId);
  if (!f) return;
  if (isFav(f.id)) s.favorites = s.favorites.filter((x) => x.id !== f.id);
  else s.favorites.unshift({ id: f.id, name: f.name, brand: f.brand || '', kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, portion: f.portion, portionLabel: f.portionLabel });
  save();
  btn.setAttribute('aria-pressed', isFav(f.id));
  toast(isFav(f.id) ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt');
};

actions['amount-save'] = () => {
  if (fs.amount <= 0) {
    toast('Bitte eine Menge über 0 eingeben.');
    return;
  }
  const meal = $('#amount-meal').value;
  const it = fs.item;
  const s = store.state;
  if (fs.editing) {
    const day = S.getDay(s, ui.date);
    const list = day.meals[fs.editing.meal];
    const idx = list.findIndex((e) => e.id === fs.editing.id);
    if (idx >= 0) {
      const old = list[idx];
      const updated = { ...old, amount: fs.amount, ...C.scaleBase(old.base, fs.amount, old.unit) };
      list.splice(idx, 1);
      day.meals[meal].push(updated);
    }
    closeSheet();
    toast('Gespeichert');
    commit();
    return;
  }
  addEntry(ui.date, meal, { name: it.brand ? `${it.name} (${it.brand})` : it.name, amount: fs.amount, unit: it.unit, base: it.base, photo: it.photo, dishId: it.dishId, foodId: it.foodId });
  if (it.dishId) {
    const dish = s.dishes.find((x) => x.id === it.dishId);
    if (dish) {
      dish.uses = (dish.uses || 0) + 1;
      dish.lastUsed = Date.now();
    }
  } else if (it.food) rememberFood(it.food);
  closeSheet();
  haptic(18);
  toast(`${it.name} eingetragen`);
  commit();
};

// ---------- Eintrag bearbeiten / löschen ----------

actions['edit-entry'] = (d) => {
  const e = S.peekDay(store.state, ui.date).meals[d.meal]?.find((x) => x.id === d.id);
  if (!e) return;
  fs.meal = d.meal;
  fs.editing = { meal: d.meal, id: e.id };
  fs.item = { name: e.name, unit: e.unit, base: e.base, photo: e.photo };
  fs.amount = e.amount;
  openSheet('Eintrag bearbeiten', amountHtml());
};

actions['entry-delete'] = () => {
  const day = S.getDay(store.state, ui.date);
  const list = day.meals[fs.editing.meal];
  const idx = list.findIndex((e) => e.id === fs.editing.id);
  if (idx < 0) return;
  const [removed] = list.splice(idx, 1);
  const meal = fs.editing.meal;
  closeSheet();
  commit();
  toast(`${removed.name} gelöscht`, () => {
    S.getDay(store.state, ui.date).meals[meal].splice(idx, 0, removed);
    commit();
  });
};

// ---------- Schnelleintrag ----------

actions['add-quick'] = () => {
  setSheet('Schnelleintrag', `
    <form class="stack" data-form="quick">
      <p class="hint">Für Essen, bei dem du nur die Kalorien kennst, z. B. vom Restaurant oder von der Packung.</p>
      <label class="field">Bezeichnung<input id="q-name" placeholder="z. B. Kantinenessen" autocomplete="off"></label>
      <label class="field">Kalorien (kcal)<input id="q-kcal" type="number" inputmode="numeric" min="1" required></label>
      <div class="grid-3">
        <label class="field">Eiweiß g<input id="q-protein" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></label>
        <label class="field">Kohlenh. g<input id="q-carbs" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></label>
        <label class="field">Fett g<input id="q-fat" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></label>
      </div>
      <label class="field">Mahlzeit<select id="q-meal">${mealOptions(fs.meal)}</select></label>
      <div class="sheet-actions">
        <button type="button" class="btn btn-ghost" data-action="amount-back">Zurück</button>
        <button class="btn btn-primary">Eintragen</button>
      </div>
    </form>`);
  $('#q-kcal').focus();
};

forms.quick = () => {
  const kcal = num($('#q-kcal').value);
  if (kcal <= 0) return;
  addEntry(ui.date, $('#q-meal').value, {
    name: $('#q-name').value.trim() || 'Schnelleintrag',
    amount: 1,
    unit: 'portion',
    base: { kcal, protein: num($('#q-protein').value), carbs: num($('#q-carbs').value), fat: num($('#q-fat').value) },
    source: 'quick',
  });
  closeSheet();
  haptic(18);
  toast(`${fmt(kcal)} kcal eingetragen`);
  commit();
};

// ---------- Eigenes Lebensmittel ----------

actions['add-custom'] = () => {
  setSheet('Eigenes Lebensmittel', `
    <form class="stack" data-form="custom-food">
      <label class="field">Name<input id="cf-name" required placeholder="z. B. Omas Linsensuppe" value="${esc(fs.query)}"></label>
      <p class="hint">Nährwerte pro 100 g – stehen auf jeder Verpackung.</p>
      <div class="grid-2">
        <label class="field">Kalorien (kcal)<input id="cf-kcal" type="number" inputmode="decimal" step="any" min="0" required></label>
        <label class="field">Eiweiß (g)<input id="cf-protein" type="number" inputmode="decimal" step="any" min="0" placeholder="0"></label>
        <label class="field">Kohlenhydrate (g)<input id="cf-carbs" type="number" inputmode="decimal" step="any" min="0" placeholder="0"></label>
        <label class="field">Fett (g)<input id="cf-fat" type="number" inputmode="decimal" step="any" min="0" placeholder="0"></label>
      </div>
      <label class="field">Übliche Portion (g)<input id="cf-portion" type="number" inputmode="decimal" min="1" value="100"></label>
      <div class="sheet-actions">
        <button type="button" class="btn btn-ghost" data-action="amount-back">Zurück</button>
        <button class="btn btn-primary">Speichern</button>
      </div>
    </form>`);
};

forms['custom-food'] = () => {
  const f = {
    id: `c-${S.uid()}`,
    name: $('#cf-name').value.trim(),
    category: 'Eigene',
    kcal: num($('#cf-kcal').value),
    protein: num($('#cf-protein').value),
    carbs: num($('#cf-carbs').value),
    fat: num($('#cf-fat').value),
    portion: num($('#cf-portion').value) || 100,
    portionLabel: 'Portion',
  };
  if (!f.name) return;
  store.state.customFoods.unshift(f);
  save();
  pickFood(f);
};

// ---------- Open Food Facts & Barcode ----------

function offToFood(p) {
  const n = p.nutriments || {};
  let kcal = n['energy-kcal_100g'];
  if (kcal == null && n.energy_100g != null) kcal = n.energy_100g / 4.184;
  const name = p.product_name_de || p.product_name;
  if (kcal == null || !name) return null;
  const r1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
  const serving = Math.round(Number(p.serving_quantity) || 0);
  return {
    id: `off-${p.code}`,
    name: name.trim(),
    brand: (p.brands || '').split(',')[0].trim(),
    kcal: Math.round(kcal),
    protein: r1(n.proteins_100g),
    carbs: r1(n.carbohydrates_100g),
    fat: r1(n.fat_100g),
    portion: serving > 0 ? serving : 100,
    portionLabel: serving > 0 ? 'Portion' : '',
  };
}

const OFF_FIELDS = 'code,product_name,product_name_de,brands,nutriments,serving_quantity';

async function offSearch(q) {
  const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=30&lc=de&fields=${OFF_FIELDS}`);
  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
  return (data.products || []).map(offToFood).filter(Boolean);
}

async function offBarcode(code) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`);
  const data = await res.json();
  return data.product ? offToFood({ code, ...data.product }) : null;
}

actions['add-online'] = async (d, btn) => {
  const q = fs.query.trim();
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Suche läuft …';
  try {
    fs.online = await offSearch(q);
    fs.onlineFor = q;
    if (!fs.online.length) {
      $('#online-section').innerHTML = `<p class="empty-note">Online auch nichts gefunden. Leg das Lebensmittel selbst an.</p>`;
      return;
    }
    renderResults();
  } catch {
    $('#online-section').innerHTML = `<p class="empty-note">Online-Suche nicht erreichbar. Prüf deine Internetverbindung.</p>`;
  }
};

let scanStream = null;
export function stopScan() {
  scanStream?.getTracks().forEach((t) => t.stop());
  scanStream = null;
}

actions['add-barcode'] = () => {
  const canScan = 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
  setSheet('Barcode', `
    ${canScan ? `<div class="scanner-wrap"><video id="scan-video" class="scanner" playsinline muted></video><span class="scan-line"></span></div>` : ''}
    <p class="hint">${canScan ? 'Halte den Strichcode in den Rahmen.' : 'Gib die Zahlen unter dem Strichcode ein (EAN, 8 oder 13 Stellen).'}</p>
    <form class="search-inline" data-form="barcode">
      <input id="ean" inputmode="numeric" pattern="[0-9]*" placeholder="z. B. 4008400402222" aria-label="Barcode-Nummer">
      <button class="btn btn-primary">Suchen</button>
    </form>
    <p class="hint" id="ean-status"></p>
    <div class="sheet-actions"><button class="btn btn-ghost" data-action="amount-back">Zurück</button></div>`);
  if (canScan) startScan();
};

async function lookupBarcode(code) {
  const status = $('#ean-status');
  if (status) status.textContent = 'Suche Produkt …';
  try {
    const f = await offBarcode(code);
    if (!f) {
      if (status) status.textContent = `Kein Produkt mit ${code} gefunden. Leg es unter „Eigenes Lebensmittel“ an.`;
      return;
    }
    fs.online = [f];
    stopScan();
    pickFood(f);
  } catch {
    if (status) status.textContent = 'Produktsuche nicht erreichbar. Prüf deine Internetverbindung.';
  }
}

forms.barcode = () => {
  const code = $('#ean').value.replace(/\D/g, '');
  if (code.length >= 8) lookupBarcode(code);
};

async function startScan() {
  const video = $('#scan-video');
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch {
    $('#ean-status').textContent = 'Kein Kamerazugriff. Gib die Nummer von Hand ein.';
    video?.closest('.scanner-wrap')?.remove();
    return;
  }
  video.srcObject = scanStream;
  await video.play().catch(() => {});
  const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
  const tick = async () => {
    if (!scanStream || !document.contains(video)) return stopScan();
    try {
      const codes = await detector.detect(video);
      if (codes.length) {
        haptic(30);
        $('#ean').value = codes[0].rawValue;
        lookupBarcode(codes[0].rawValue);
        return;
      }
    } catch {
      /* Bild noch nicht bereit */
    }
    setTimeout(tick, 250);
  };
  tick();
}

export { amountLabel };
