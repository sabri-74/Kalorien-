import * as C from './calc.js';
import { FOODS, CATEGORIES, searchFoods } from './foods.js';
import { EXERCISES, CARDIO, PLANS, MUSCLES, STRENGTH_MET, exerciseById } from './exercises.js';
import * as S from './store.js';
import { barChart, lineChart } from './charts.js';

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------

let state = S.load();

const ui = {
  tab: 'today',
  date: C.dateKey(),
  // Lebensmittel-Dialog
  foodMeal: 'breakfast',
  foodTab: 'search',
  foodCat: null,
  selectedFood: null,
  editing: null, // { meal, entryId }
  online: { results: [], status: '' },
  // Fortschritt
  range: 7,
  // Training
  muscle: null,
  rest: null, // { end }
};

const DEFAULT_PROFILE = {
  name: '',
  sex: 'female',
  age: 30,
  height: 170,
  weight: 70,
  activity: 'light',
  goal: 'lose',
  targetWeight: 65,
};

const REST_SECONDS = 90;

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n, d = 0) => Number(n || 0).toLocaleString('de-DE', { maximumFractionDigits: d });
const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

function profile() {
  return state.profile || DEFAULT_PROFILE;
}

function currentWeight() {
  const last = state.weights[state.weights.length - 1];
  return last ? last.kg : profile().weight;
}

function targets() {
  const p = { ...profile(), weight: currentWeight() };
  const kcal = state.settings.customKcal || C.calorieTarget(p);
  return {
    kcal,
    ...C.macroTargets(kcal, p.weight, p.goal),
    water: C.waterTarget(p.weight),
    bmr: C.bmr(p),
    tdee: C.tdee(p),
  };
}

function dayTotals(key) {
  const day = S.peekDay(state, key);
  const eaten = C.sumNutrients(S.dayEntries(day));
  const burned = day.workouts.reduce((s, w) => s + (w.kcal || 0), 0);
  return { day, eaten, burned };
}

function commit() {
  if (!S.save(state)) toast('Speichern nicht möglich – Browser-Speicher ist blockiert.');
  render();
}

// ---------------------------------------------------------------------------
// Allgemeine UI-Helfer
// ---------------------------------------------------------------------------

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2400);
}

function confirmDialog(text, okLabel = 'Löschen') {
  const dlg = $('#confirm-dialog');
  $('#confirm-text').textContent = text;
  $('#confirm-ok').textContent = okLabel;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
  });
}

function dateLabel(key) {
  const today = C.dateKey();
  if (key === today) return 'Heute';
  if (key === C.addDays(today, -1)) return 'Gestern';
  if (key === C.addDays(today, 1)) return 'Morgen';
  return C.parseKey(key).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

// ---------------------------------------------------------------------------
// Rendern
// ---------------------------------------------------------------------------

function render() {
  applyTheme();
  document.querySelectorAll('.tab').forEach((b) => {
    if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  document.querySelectorAll('.view').forEach((v) => (v.hidden = v.id !== `view-${ui.tab}`));
  $('#datenav').style.visibility = ui.tab === 'today' || ui.tab === 'training' ? 'visible' : 'hidden';
  $('#date-label').textContent = dateLabel(ui.date);

  if (ui.tab === 'today') renderToday();
  if (ui.tab === 'training') renderTraining();
  if (ui.tab === 'progress') renderProgress();
  if (ui.tab === 'profile') renderProfile();
}

function setupBanner() {
  if (state.profile) return '';
  return `
    <div class="banner">
      <b>Willkommen! Die Ziele unten basieren auf einem Beispielprofil.</b>
      <p class="small">Trag Größe, Gewicht und Ziel ein, dann berechnet die App deinen persönlichen Kalorienbedarf.</p>
      <div class="row">
        <button class="btn btn-sm" data-action="goto" data-tab="profile">Profil einrichten</button>
        <button class="btn btn-sm btn-ghost" data-action="demo">Beispieldaten ansehen</button>
      </div>
    </div>`;
}

// ---------- Tagebuch ----------

function renderToday() {
  const t = targets();
  const { day, eaten, burned } = dayTotals(ui.date);
  const budget = t.kcal + burned;
  const remaining = budget - eaten.kcal;
  const over = remaining < 0;
  const R = 54;
  const CIRC = 2 * Math.PI * R;
  const frac = Math.min(1, eaten.kcal / Math.max(1, budget));

  const macro = (key, label, color) => {
    const target = t[key];
    const val = eaten[key];
    const pct = Math.min(100, (val / Math.max(1, target)) * 100);
    return `
      <div class="macro" data-over="${val > target * 1.1}">
        <div class="macro-head"><b>${label}</b><span class="tabular">${fmt(val)} / ${fmt(target)} g</span></div>
        <div class="bar-track"><div class="bar-fill" style="--c: var(${color}); width: ${pct}%"></div></div>
      </div>`;
  };

  const yesterday = S.peekDay(state, C.addDays(ui.date, -1));
  const meals = S.MEALS.map((m) => {
    const entries = day.meals[m.id] || [];
    const sum = C.sumNutrients(entries);
    const canCopy = !entries.length && (yesterday.meals[m.id] || []).length > 0;
    return `
      <article class="card">
        <div class="meal-head">
          <h3>${m.label}</h3>
          <span class="kcal num small muted">${entries.length ? `${fmt(sum.kcal)} kcal` : ''}</span>
          <button class="icon-btn add-btn" data-action="open-food" data-meal="${m.id}" aria-label="${m.label}: Lebensmittel hinzufügen">+</button>
        </div>
        ${
          entries.length
            ? `<ul class="entries">${entries
                .map(
                  (e) => `
              <li class="entry">
                <button class="entry-name list-item" style="border:0;padding:0" data-action="edit-entry" data-meal="${m.id}" data-id="${e.id}">
                  <span>${esc(e.name)}<small>${fmt(e.amount)} g · E ${fmt(e.protein)} · K ${fmt(e.carbs)} · F ${fmt(e.fat)}</small></span>
                </button>
                <span class="num small">${fmt(e.kcal)}</span>
                <button class="icon-btn" data-action="del-entry" data-meal="${m.id}" data-id="${e.id}" aria-label="${esc(e.name)} entfernen">✕</button>
              </li>`,
                )
                .join('')}</ul>`
            : `<p class="empty">Noch nichts eingetragen.${
                canCopy ? ` <button class="btn btn-sm btn-ghost" data-action="copy-meal" data-meal="${m.id}">Von gestern übernehmen</button>` : ''
              }</p>`
        }
      </article>`;
  }).join('');

  const glasses = Math.max(4, Math.round(t.water / 250));
  const glassHtml = Array.from({ length: glasses }, (_, i) => {
    const filled = Math.max(0, Math.min(1, (day.water - i * 250) / 250));
    return `<button class="glass" data-action="water-set" data-ml="${(i + 1) * 250}" data-full="${filled > 0}" style="--lvl:${filled * 100}%" aria-label="${fmt(((i + 1) * 250) / 1000, 2)} Liter"></button>`;
  }).join('');

  const workouts = day.workouts;

  $('#view-today').innerHTML = `
    ${setupBanner()}
    <article class="card">
      <div class="budget">
        <div class="ring ${over ? 'over' : ''}">
          <svg viewBox="0 0 132 132" aria-hidden="true">
            <circle class="track" cx="66" cy="66" r="${R}"></circle>
            ${frac > 0 ? `<circle class="fill" cx="66" cy="66" r="${R}" stroke-dasharray="${frac * CIRC} ${CIRC}"></circle>` : ''}
          </svg>
          <div class="ring-center">
            <span class="ring-value">${fmt(Math.abs(remaining))}</span>
            <span class="ring-caption">${over ? 'kcal zu viel' : 'kcal übrig'}</span>
          </div>
        </div>
        <dl class="equation">
          <dt>Ziel</dt><dd class="num">${fmt(t.kcal)}</dd>
          <dt>− Gegessen</dt><dd class="num">${fmt(eaten.kcal)}</dd>
          <dt>+ Training</dt><dd class="num">${fmt(burned)}</dd>
          <dt class="total">= ${over ? 'Überschuss' : 'Übrig'}</dt><dd class="num total">${fmt(remaining)}</dd>
        </dl>
      </div>
      <div class="macros">
        ${macro('protein', 'Eiweiß', '--protein')}
        ${macro('carbs', 'Kohlenh.', '--carbs')}
        ${macro('fat', 'Fett', '--fat')}
      </div>
    </article>

    ${meals}

    <article class="card">
      <div class="meal-head">
        <h3>Wasser</h3>
        <span class="kcal num small muted">${fmt(day.water / 1000, 2)} / ${fmt(t.water / 1000, 2)} l</span>
      </div>
      <div class="water">${glassHtml}</div>
      <div class="row">
        <button class="btn btn-sm btn-ghost" data-action="water-add" data-ml="-250">− 250 ml</button>
        <button class="btn btn-sm btn-soft" data-action="water-add" data-ml="250">+ 250 ml</button>
        <button class="btn btn-sm btn-soft" data-action="water-add" data-ml="500">+ 500 ml</button>
      </div>
    </article>

    <article class="card">
      <div class="meal-head">
        <h3>Training</h3>
        <span class="kcal num small muted">${burned ? `−${fmt(burned)} kcal` : ''}</span>
        <button class="icon-btn add-btn" data-action="goto" data-tab="training" aria-label="Training eintragen">+</button>
      </div>
      ${
        workouts.length
          ? `<ul class="entries">${workouts.map(workoutRow).join('')}</ul>`
          : '<p class="empty">Kein Training eingetragen.</p>'
      }
    </article>`;
}

function workoutRow(w) {
  const detail =
    w.type === 'strength'
      ? `${w.exercises.length} Übungen · ${fmt(C.volume(w.exercises.flatMap((e) => e.sets)))} kg Volumen`
      : `${fmt(w.minutes)} Min.`;
  return `
    <li class="entry">
      <span class="entry-name">${esc(w.name)}<small>${detail}${w.type === 'strength' ? ` · ${fmt(w.minutes)} Min.` : ''}</small></span>
      <span class="num small">${fmt(w.kcal)}</span>
      <button class="icon-btn" data-action="del-workout" data-id="${w.id}" aria-label="${esc(w.name)} entfernen">✕</button>
    </li>`;
}

// ---------- Lebensmittel-Dialog ----------

function allFoods() {
  return [...state.customFoods, ...FOODS];
}

function openFood(meal) {
  ui.foodMeal = meal;
  ui.selectedFood = null;
  ui.editing = null;
  ui.foodTab = 'search';
  ui.foodCat = null;
  renderFood();
  $('#food-dialog').showModal();
  $('#food-search')?.focus();
}

function renderFood() {
  const body = $('#food-body');
  const mealLabel = S.MEALS.find((m) => m.id === ui.foodMeal)?.label;
  $('#food-title').textContent = ui.editing ? 'Eintrag bearbeiten' : `${mealLabel}: hinzufügen`;

  if (ui.selectedFood) {
    renderAmount(body);
    return;
  }

  const tabs = [
    ['search', 'Datenbank'],
    ['online', 'Online & Barcode'],
    ['custom', 'Eigenes'],
  ];
  const seg = `<div class="seg" role="group" aria-label="Quelle">${tabs
    .map(([id, l]) => `<button data-action="food-tab" data-id="${id}" aria-pressed="${ui.foodTab === id}">${l}</button>`)
    .join('')}</div>`;

  if (ui.foodTab === 'search') {
    body.innerHTML = `
      ${seg}
      <input id="food-search" type="search" placeholder="Suchen, z. B. Haferflocken" autocomplete="off" aria-label="Lebensmittel suchen">
      <div class="chips">${CATEGORIES.map(
        (c) => `<button class="chip" data-action="food-cat" data-id="${esc(c)}" aria-pressed="${ui.foodCat === c}">${esc(c)}</button>`,
      ).join('')}</div>
      <div id="food-results"></div>`;
    renderFoodResults();
  } else if (ui.foodTab === 'online') {
    const canScan = 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
    body.innerHTML = `
      ${seg}
      <form class="row" data-form="off-search" style="flex-wrap:nowrap">
        <input id="off-query" type="search" placeholder="Produktname oder Barcode (EAN)" autocomplete="off" aria-label="Produkt suchen">
        <button class="btn">Suchen</button>
      </form>
      ${canScan ? '<button class="btn btn-ghost btn-block" data-action="scan">Barcode mit Kamera scannen</button>' : ''}
      <video id="scan-video" class="scanner" playsinline muted hidden></video>
      <p class="small muted" id="off-status">${esc(ui.online.status || 'Produktdaten von Open Food Facts. Benötigt eine Internetverbindung.')}</p>
      <ul class="list" id="off-results">${ui.online.results.map(foodItem).join('')}</ul>`;
  } else {
    body.innerHTML = `
      ${seg}
      <form class="stack" data-form="custom-food">
        <label>Name<input id="cf-name" required placeholder="z. B. Omas Linsensuppe"></label>
        <p class="small muted">Nährwerte pro 100 g (steht auf der Verpackung)</p>
        <div class="grid-2">
          <label>Kalorien (kcal)<input id="cf-kcal" type="number" inputmode="decimal" step="any" min="0" required></label>
          <label>Eiweiß (g)<input id="cf-protein" type="number" inputmode="decimal" step="any" min="0" value="0"></label>
          <label>Kohlenhydrate (g)<input id="cf-carbs" type="number" inputmode="decimal" step="any" min="0" value="0"></label>
          <label>Fett (g)<input id="cf-fat" type="number" inputmode="decimal" step="any" min="0" value="0"></label>
        </div>
        <label>Übliche Portion (g)<input id="cf-portion" type="number" inputmode="decimal" min="1" value="100"></label>
        <button class="btn btn-block">Speichern und auswählen</button>
      </form>
      ${
        state.customFoods.length
          ? `<h3>Deine Lebensmittel</h3><ul class="list">${state.customFoods
              .map(
                (f) => `<li class="row" style="flex-wrap:nowrap">${foodItem(f).replace('<li>', '').replace('</li>', '')}<button class="icon-btn" data-action="del-custom" data-id="${f.id}" aria-label="${esc(f.name)} löschen">✕</button></li>`,
              )
              .join('')}</ul>`
          : ''
      }`;
  }
}

function foodItem(f) {
  return `<li><button class="list-item" data-action="pick-food" data-id="${esc(f.id)}">
    <span>${esc(f.name)}<small>${f.brand ? `${esc(f.brand)} · ` : ''}${fmt(f.kcal)} kcal · E ${fmt(f.protein, 1)} · K ${fmt(f.carbs, 1)} · F ${fmt(f.fat, 1)} je 100 g</small></span>
    <span class="add-btn icon-btn" aria-hidden="true">+</span>
  </button></li>`;
}

function renderFoodResults() {
  const box = $('#food-results');
  if (!box) return;
  const q = $('#food-search')?.value || '';
  let html = '';
  if (!q && !ui.foodCat && state.recentFoods.length) {
    html += `<p class="eyebrow">Zuletzt verwendet</p><ul class="list">${state.recentFoods.slice(0, 8).map(foodItem).join('')}</ul>`;
  }
  let list = searchFoods(allFoods(), q);
  if (ui.foodCat) list = list.filter((f) => f.category === ui.foodCat);
  html += `<p class="eyebrow" style="margin-top:12px">${q || ui.foodCat ? `${list.length} Treffer` : 'Alle Lebensmittel'}</p>`;
  html += list.length
    ? `<ul class="list">${list.slice(0, 60).map(foodItem).join('')}</ul>`
    : `<p class="empty">Nichts gefunden. Probier die Online-Suche oder leg ein eigenes Lebensmittel an.</p>`;
  box.innerHTML = html;
}

function findFood(id) {
  return (
    allFoods().find((f) => f.id === id) ||
    ui.online.results.find((f) => f.id === id) ||
    state.recentFoods.find((f) => f.id === id)
  );
}

function renderAmount(body) {
  const f = ui.selectedFood;
  const amount = ui.amount;
  const n = C.scaleFood(f, amount);
  const portions = [[100, '100 g']];
  if (f.portion && f.portion !== 100) portions.unshift([f.portion, `1 ${f.portionLabel || 'Portion'} (${fmt(f.portion)} g)`]);
  if (f.portion) portions.push([f.portion * 2, `2× ${f.portionLabel || 'Portion'}`]);

  body.innerHTML = `
    <div>
      <h3>${esc(f.name)}</h3>
      <p class="small muted">${f.brand ? `${esc(f.brand)} · ` : ''}${fmt(f.kcal)} kcal je 100 g</p>
    </div>
    <div class="chips">${portions
      .map(([g, l]) => `<button class="chip" data-action="set-amount" data-g="${g}" aria-pressed="${amount === g}">${esc(l)}</button>`)
      .join('')}</div>
    <div class="grid-2">
      <label>Menge (g / ml)<input id="food-amount" type="number" inputmode="decimal" min="1" step="any" value="${amount}"></label>
      <label>Mahlzeit<select id="food-meal">${S.MEALS.map(
        (m) => `<option value="${m.id}" ${m.id === ui.foodMeal ? 'selected' : ''}>${m.label}</option>`,
      ).join('')}</select></label>
    </div>
    <div class="nutri" id="food-nutri">${nutriHtml(n)}</div>
    <div class="row-end">
      <button class="btn btn-ghost" data-action="food-back">${ui.editing ? 'Abbrechen' : 'Zurück'}</button>
      <button class="btn" data-action="food-save">${ui.editing ? 'Speichern' : 'Hinzufügen'}</button>
    </div>`;
}

function nutriHtml(n) {
  return `
    <div><b>${fmt(n.kcal)}</b><span>kcal</span></div>
    <div><b>${fmt(n.protein, 1)}</b><span>Eiweiß g</span></div>
    <div><b>${fmt(n.carbs, 1)}</b><span>Kohlenh. g</span></div>
    <div><b>${fmt(n.fat, 1)}</b><span>Fett g</span></div>`;
}

function pickFood(food) {
  ui.selectedFood = food;
  ui.amount = food.portion || 100;
  renderFood();
}

function saveFoodEntry() {
  const f = ui.selectedFood;
  const amount = num($('#food-amount').value);
  if (amount <= 0) {
    toast('Bitte eine Menge über 0 eingeben.');
    return;
  }
  const meal = $('#food-meal').value;
  const per100 = { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat };
  const entry = { id: S.uid(), foodId: f.id, name: f.brand ? `${f.name} (${f.brand})` : f.name, amount, per100, ...C.scaleFood(f, amount) };
  const day = S.getDay(state, ui.date);

  if (ui.editing) {
    const list = day.meals[ui.editing.meal];
    const idx = list.findIndex((e) => e.id === ui.editing.entryId);
    if (idx >= 0) list.splice(idx, 1);
    entry.id = ui.editing.entryId;
    entry.name = ui.editing.name;
  }
  day.meals[meal].push(entry);

  // Zuletzt verwendet (inkl. Online-Produkte, damit sie offline verfügbar bleiben)
  const recent = { id: f.id, name: f.name, brand: f.brand || '', kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, portion: f.portion, portionLabel: f.portionLabel };
  state.recentFoods = [recent, ...state.recentFoods.filter((r) => r.id !== f.id)].slice(0, 20);

  $('#food-dialog').close();
  toast(ui.editing ? 'Eintrag gespeichert' : `${f.name} hinzugefügt`);
  ui.editing = null;
  commit();
}

// ---------- Open Food Facts ----------

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

async function onlineSearch(query) {
  const q = query.trim();
  if (!q) return;
  const status = $('#off-status');
  const setStatus = (s) => {
    ui.online.status = s;
    if (status) status.textContent = s;
  };
  setStatus('Suche läuft …');
  const fields = 'code,product_name,product_name_de,brands,nutriments,serving_quantity';
  const isCode = /^\d{8,14}$/.test(q);
  const url = isCode
    ? `https://world.openfoodfacts.org/api/v2/product/${q}.json?fields=${fields}`
    : `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=30&lc=de&fields=${fields}`;
  try {
    const res = await fetch(url);
    if (!res.ok && !isCode) throw new Error(res.status);
    const data = await res.json();
    const products = isCode ? (data.product ? [{ code: q, ...data.product }] : []) : data.products || [];
    ui.online.results = products.map(offToFood).filter(Boolean);
    setStatus(
      ui.online.results.length
        ? `${ui.online.results.length} Produkte gefunden (Open Food Facts)`
        : isCode
          ? `Kein Produkt mit Barcode ${q} gefunden. Leg es unter „Eigenes“ an.`
          : 'Keine Produkte gefunden.',
    );
    if (isCode && ui.online.results.length === 1) {
      pickFood(ui.online.results[0]);
      return;
    }
  } catch {
    ui.online.results = [];
    setStatus('Online-Suche nicht erreichbar. Prüf deine Internetverbindung oder nutz die Datenbank.');
  }
  const list = $('#off-results');
  if (list) list.innerHTML = ui.online.results.map(foodItem).join('');
}

let scanStream = null;
async function startScan() {
  const video = $('#scan-video');
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch {
    toast('Kein Kamerazugriff. Gib den Barcode von Hand ein.');
    return;
  }
  video.srcObject = scanStream;
  video.hidden = false;
  await video.play();
  const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
  const tick = async () => {
    if (!scanStream) return;
    try {
      const codes = await detector.detect(video);
      if (codes.length) {
        const code = codes[0].rawValue;
        stopScan();
        const input = $('#off-query');
        if (input) input.value = code;
        onlineSearch(code);
        return;
      }
    } catch {
      /* Frame noch nicht bereit */
    }
    setTimeout(tick, 250);
  };
  tick();
}

function stopScan() {
  scanStream?.getTracks().forEach((t) => t.stop());
  scanStream = null;
  const video = $('#scan-video');
  if (video) video.hidden = true;
}

// ---------- Training ----------

function allWorkouts() {
  return Object.entries(state.days)
    .flatMap(([date, d]) => d.workouts.map((w) => ({ ...w, date })))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function lastSetsFor(exId) {
  for (const w of allWorkouts()) {
    if (w.type !== 'strength') continue;
    const ex = w.exercises.find((e) => e.id === exId);
    if (ex && ex.sets.length) return ex.sets;
  }
  return null;
}

function personalRecords() {
  const best = {};
  for (const w of allWorkouts()) {
    if (w.type !== 'strength') continue;
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        const orm = C.oneRepMax(s.weight, s.reps);
        if (orm > (best[ex.id]?.orm || 0)) best[ex.id] = { orm, set: s, date: w.date, name: ex.name };
      }
    }
  }
  return Object.values(best).sort((a, b) => b.orm - a.orm);
}

function newExercise(id) {
  const prev = lastSetsFor(id);
  const sets = prev
    ? prev.map((s) => ({ reps: s.reps, weight: s.weight, done: false }))
    : Array.from({ length: 3 }, () => ({ reps: '', weight: '', done: false }));
  return { id, name: exerciseById(id)?.name || id, sets };
}

function startWorkout(name, exerciseIds) {
  state.activeWorkout = { name, start: Date.now(), date: ui.date, exercises: exerciseIds.map(newExercise) };
  commit();
  window.scrollTo({ top: 0 });
}

function elapsedMinutes() {
  const w = state.activeWorkout;
  return w ? Math.max(1, Math.round((Date.now() - w.start) / 60000)) : 0;
}

function renderTraining() {
  const w = state.activeWorkout;
  const weight = currentWeight();
  const v = $('#view-training');

  if (w) {
    const exOptions = MUSCLES.map(
      (m) =>
        `<optgroup label="${m}">${EXERCISES.filter((e) => e.muscle === m)
          .map((e) => `<option value="${e.id}">${esc(e.name)}</option>`)
          .join('')}</optgroup>`,
    ).join('');
    v.innerHTML = `
      <div class="timer" id="rest-timer" ${ui.rest ? '' : 'hidden'}>
        <span>Pause</span><span class="num" id="rest-left"></span>
        <button class="btn btn-sm btn-ghost" data-action="rest-stop">Überspringen</button>
      </div>
      <article class="card">
        <div class="section-head" style="margin:0">
          <div><p class="eyebrow">Training läuft · ${dateLabel(w.date)}</p><h2>${esc(w.name)}</h2></div>
          <span class="num" id="wo-elapsed">${elapsedMinutes()} Min.</span>
        </div>
        ${w.exercises
          .map((ex, ei) => {
            const info = exerciseById(ex.id);
            return `
          <div class="workout-ex">
            <div class="meal-head">
              <h3>${esc(ex.name)}</h3>
              <button class="icon-btn" data-action="wo-del-ex" data-ex="${ei}" aria-label="${esc(ex.name)} entfernen">✕</button>
            </div>
            ${info?.tip ? `<p class="small muted">${esc(info.tip)}</p>` : ''}
            <div class="sets">
              <div class="set set-head"><span>#</span><span>Wdh.</span><span>kg</span><span></span><span></span></div>
              ${ex.sets
                .map(
                  (s, si) => `
                <div class="set">
                  <span class="idx">${si + 1}</span>
                  <input type="number" inputmode="numeric" min="0" id="s-${ei}-${si}-reps" data-ex="${ei}" data-set="${si}" data-field="reps" value="${s.reps}" aria-label="Wiederholungen Satz ${si + 1}">
                  <input type="number" inputmode="decimal" min="0" step="0.5" id="s-${ei}-${si}-weight" data-ex="${ei}" data-set="${si}" data-field="weight" value="${s.weight}" aria-label="Gewicht Satz ${si + 1}">
                  <button class="check" data-action="set-done" data-ex="${ei}" data-set="${si}" aria-pressed="${s.done}" aria-label="Satz ${si + 1} erledigt">✓</button>
                  <button class="icon-btn" data-action="set-del" data-ex="${ei}" data-set="${si}" aria-label="Satz ${si + 1} löschen">−</button>
                </div>`,
                )
                .join('')}
            </div>
            <button class="btn btn-sm btn-ghost" style="margin-top:8px" data-action="set-add" data-ex="${ei}">+ Satz</button>
          </div>`;
          })
          .join('')}
        <div class="row" style="flex-wrap:nowrap">
          <select id="wo-add-ex" aria-label="Übung hinzufügen">${exOptions}</select>
          <button class="btn btn-soft" data-action="wo-add-ex">Hinzufügen</button>
        </div>
        <label>Dauer in Minuten (leer = gemessene Zeit)<input id="wo-min" type="number" inputmode="numeric" min="1" placeholder="${elapsedMinutes()}"></label>
        <div class="row-end">
          <button class="btn btn-ghost" data-action="wo-cancel">Verwerfen</button>
          <button class="btn" data-action="wo-finish">Training beenden</button>
        </div>
      </article>`;
    updateTimers();
    return;
  }

  const day = S.peekDay(state, ui.date);
  const history = allWorkouts().slice(0, 8);
  const prs = personalRecords().slice(0, 6);
  const lib = EXERCISES.filter((e) => !ui.muscle || e.muscle === ui.muscle);

  v.innerHTML = `
    ${setupBanner()}
    <article class="card">
      <h2>Ausdauer eintragen</h2>
      <form class="stack" data-form="cardio">
        <label>Aktivität<select id="cardio-act">${CARDIO.map(
          (a) => `<option value="${a.id}">${esc(a.name)}</option>`,
        ).join('')}</select></label>
        <div class="grid-2">
          <label>Dauer (Min.)<input id="cardio-min" type="number" inputmode="numeric" min="1" value="30"></label>
          <div><span class="eyebrow">Verbrauch</span><p class="tile-value" id="cardio-kcal">–</p></div>
        </div>
        <p class="small muted">Berechnet mit MET-Werten und deinem Gewicht (${fmt(weight, 1)} kg).</p>
        <button class="btn btn-block">Für ${dateLabel(ui.date).toLowerCase() === 'heute' ? 'heute' : dateLabel(ui.date)} eintragen</button>
      </form>
    </article>

    <article class="card">
      <h2>Krafttraining</h2>
      <p class="small muted">Starte einen Plan oder ein freies Training. Gewichte vom letzten Mal werden vorgeschlagen.</p>
      <button class="btn btn-block btn-soft" data-action="wo-start-free">Freies Training starten</button>
      ${PLANS.map(
        (p) => `
        <div class="workout-ex">
          <div class="meal-head"><h3>${esc(p.name)}</h3><span class="pill">${esc(p.level)}</span></div>
          <p class="small muted">${esc(p.scheme)}</p>
          <div class="plan-days">${p.days
            .map(
              (d, i) =>
                `<button class="btn btn-sm btn-ghost" data-action="wo-start-plan" data-plan="${p.id}" data-day="${i}" title="${esc(
                  d.exercises.map((id) => exerciseById(id).name).join(', '),
                )}">${esc(d.name)} starten</button>`,
            )
            .join('')}</div>
        </div>`,
      ).join('')}
    </article>

    <article class="card">
      <div class="meal-head"><h3>${dateLabel(ui.date)}</h3></div>
      ${day.workouts.length ? `<ul class="entries">${day.workouts.map(workoutRow).join('')}</ul>` : '<p class="empty">Noch kein Training an diesem Tag.</p>'}
    </article>

    ${
      prs.length
        ? `<article class="card">
      <h3>Persönliche Bestleistungen</h3>
      <p class="small muted">Geschätztes 1-Wiederholungs-Maximum (Epley-Formel)</p>
      <ul class="entries">${prs
        .map(
          (r) => `<li class="entry" style="grid-template-columns:minmax(0,1fr) auto">
          <span class="entry-name">${esc(r.name)}<small>${fmt(r.set.reps)} × ${fmt(r.set.weight, 1)} kg · ${dateLabel(r.date)}</small></span>
          <span class="num">${fmt(r.orm, 1)} kg</span></li>`,
        )
        .join('')}</ul>
    </article>`
        : ''
    }

    ${
      history.length
        ? `<article class="card"><h3>Letzte Einheiten</h3><ul class="entries">${history
            .map(
              (h) => `<li class="entry" style="grid-template-columns:minmax(0,1fr) auto">
            <span class="entry-name">${esc(h.name)}<small>${dateLabel(h.date)} · ${fmt(h.minutes)} Min.</small></span>
            <span class="num small">${fmt(h.kcal)} kcal</span></li>`,
            )
            .join('')}</ul></article>`
        : ''
    }

    <article class="card">
      <h3>Übungen</h3>
      <div class="chips">
        <button class="chip" data-action="muscle" data-id="" aria-pressed="${!ui.muscle}">Alle</button>
        ${MUSCLES.map((m) => `<button class="chip" data-action="muscle" data-id="${m}" aria-pressed="${ui.muscle === m}">${m}</button>`).join('')}
      </div>
      <ul class="entries">${lib
        .map(
          (e) => `<li class="entry" style="grid-template-columns:minmax(0,1fr) auto">
          <span class="entry-name">${esc(e.name)}<small>${esc(e.muscle)} · ${esc(e.tip)}</small></span>
          <button class="btn btn-sm btn-ghost" data-action="wo-start-one" data-id="${e.id}">Starten</button></li>`,
        )
        .join('')}</ul>
    </article>`;
  updateCardioPreview();
}

function updateCardioPreview() {
  const act = CARDIO.find((a) => a.id === $('#cardio-act')?.value);
  const min = num($('#cardio-min')?.value);
  const out = $('#cardio-kcal');
  if (out && act) out.innerHTML = `${fmt(C.metCalories(act.met, currentWeight(), min))}<small>kcal</small>`;
}

function finishWorkout() {
  const w = state.activeWorkout;
  const minutes = num($('#wo-min')?.value) || elapsedMinutes();
  const exercises = w.exercises
    .map((ex) => ({
      id: ex.id,
      name: ex.name,
      sets: ex.sets.filter((s) => num(s.reps) > 0).map((s) => ({ reps: num(s.reps), weight: num(s.weight) })),
    }))
    .filter((ex) => ex.sets.length);
  if (!exercises.length) {
    toast('Trag mindestens einen Satz mit Wiederholungen ein.');
    return;
  }
  S.getDay(state, w.date).workouts.push({
    id: S.uid(),
    type: 'strength',
    name: w.name,
    minutes,
    kcal: C.metCalories(STRENGTH_MET, currentWeight(), minutes),
    exercises,
  });
  state.activeWorkout = null;
  ui.rest = null;
  toast('Training gespeichert. Stark!');
  commit();
}

function updateTimers() {
  const el = $('#wo-elapsed');
  if (el) el.textContent = `${elapsedMinutes()} Min.`;
  const box = $('#rest-timer');
  if (!box) return;
  if (!ui.rest) {
    box.hidden = true;
    return;
  }
  const left = Math.ceil((ui.rest.end - Date.now()) / 1000);
  if (left <= 0) {
    ui.rest = null;
    box.hidden = true;
    navigator.vibrate?.([200, 100, 200]);
    toast('Pause vorbei – nächster Satz!');
    return;
  }
  box.hidden = false;
  $('#rest-left').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}
setInterval(() => {
  if (ui.tab === 'training' && state.activeWorkout) updateTimers();
}, 1000);

// ---------- Fortschritt ----------

function renderProgress() {
  const t = targets();
  const today = C.dateKey();
  const days = C.lastDays(today, ui.range);
  const logged = days.filter((k) => S.hasActivity(state, k));
  const avg = logged.length ? logged.reduce((s, k) => s + dayTotals(k).eaten.kcal, 0) / logged.length : 0;
  const streak = C.streak((k) => S.hasActivity(state, k), today);
  const weekWorkouts = C.lastDays(today, 7).flatMap((k) => S.peekDay(state, k).workouts);
  const weekBurn = weekWorkouts.reduce((s, w) => s + w.kcal, 0);

  const p = profile();
  const w = currentWeight();
  const bmiVal = C.bmi(w, p.height);
  const cat = C.bmiCategory(bmiVal);
  const first = state.weights[0];
  const delta = first ? w - first.kg : 0;

  const avgMacros = logged.length
    ? ['protein', 'carbs', 'fat'].map((k) => logged.reduce((s, d) => s + dayTotals(d).eaten[k], 0) / logged.length)
    : [0, 0, 0];

  $('#view-progress').innerHTML = `
    ${setupBanner()}
    <div class="tiles">
      <div class="tile"><span class="eyebrow">Serie</span><span class="tile-value">${streak}<small>${streak === 1 ? 'Tag' : 'Tage'}</small></span><span class="small muted">in Folge eingetragen</span></div>
      <div class="tile"><span class="eyebrow">Ø Kalorien</span><span class="tile-value">${fmt(avg)}<small>kcal</small></span><span class="small muted">Ziel ${fmt(t.kcal)} · ${ui.range} Tage</span></div>
      <div class="tile"><span class="eyebrow">Gewicht</span><span class="tile-value">${fmt(w, 1)}<small>kg</small></span><span class="small muted">${first ? `${delta <= 0 ? '−' : '+'}${fmt(Math.abs(delta), 1)} kg seit Start` : 'Noch keine Messung'}</span></div>
      <div class="tile"><span class="eyebrow">BMI</span><span class="tile-value">${fmt(bmiVal, 1)}</span><span><span class="pill pill-${cat.level}">${cat.label}</span></span></div>
    </div>

    <article class="card">
      <div class="section-head" style="margin:0">
        <h3>Kalorien pro Tag</h3>
        <div class="seg" role="group" aria-label="Zeitraum">
          <button data-action="range" data-n="7" aria-pressed="${ui.range === 7}">7 Tage</button>
          <button data-action="range" data-n="30" aria-pressed="${ui.range === 30}">30 Tage</button>
        </div>
      </div>
      <div class="chart" id="kcal-chart"></div>
      <p class="small muted">Rote Säulen liegen mehr als 5 % über dem Ziel.</p>
    </article>

    <article class="card">
      <h3>Ø Makros (${ui.range} Tage)</h3>
      <div class="macros">
        ${[
          ['Eiweiß', avgMacros[0], t.protein, '--protein'],
          ['Kohlenh.', avgMacros[1], t.carbs, '--carbs'],
          ['Fett', avgMacros[2], t.fat, '--fat'],
        ]
          .map(
            ([l, v, target, c]) => `<div class="macro"><div class="macro-head"><b>${l}</b><span class="tabular">${fmt(v)} / ${fmt(target)} g</span></div>
          <div class="bar-track"><div class="bar-fill" style="--c:var(${c});width:${Math.min(100, (v / target) * 100)}%"></div></div></div>`,
          )
          .join('')}
      </div>
      <p class="small muted">Training diese Woche: ${weekWorkouts.length} Einheiten · ${fmt(weekBurn)} kcal verbrannt</p>
    </article>

    <article class="card">
      <h3>Gewicht</h3>
      <form class="row" data-form="weight" style="flex-wrap:nowrap">
        <input id="weight-input" type="number" inputmode="decimal" step="0.1" min="20" max="400" placeholder="${fmt(w, 1)}" aria-label="Gewicht in kg">
        <button class="btn">Eintragen</button>
      </form>
      ${
        state.weights.length
          ? `<div class="chart" id="weight-chart"></div>
             <div class="legend"><span><i></i>Messung</span><span><i class="dash"></i>Trend (7 Messungen)</span>${p.targetWeight ? '<span><i class="target"></i>Zielgewicht</span>' : ''}</div>
             <ul class="entries">${state.weights
               .slice(-5)
               .reverse()
               .map(
                 (x) => `<li class="entry"><span class="entry-name">${dateLabel(x.date)}</span><span class="num">${fmt(x.kg, 1)} kg</span>
                   <button class="icon-btn" data-action="del-weight" data-date="${x.date}" aria-label="Messung vom ${dateLabel(x.date)} löschen">✕</button></li>`,
               )
               .join('')}</ul>`
          : '<p class="empty">Trag dein Gewicht regelmäßig ein, am besten morgens nüchtern. Der Trend glättet Tagesschwankungen.</p>'
      }
    </article>`;

  barChart(
    $('#kcal-chart'),
    days.map((k) => {
      const d = C.parseKey(k);
      return {
        label: ui.range === 7 ? d.toLocaleDateString('de-DE', { weekday: 'short' }) : `${d.getDate()}.`,
        sub: d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
        value: dayTotals(k).eaten.kcal,
      };
    }),
    { target: t.kcal, format: (v) => fmt(v) },
  );

  if (state.weights.length) {
    const ws = state.weights.slice(-60);
    const trend = C.movingAverage(
      ws.map((x) => x.kg),
      7,
    );
    lineChart(
      $('#weight-chart'),
      ws.map((x, i) => ({
        label: C.parseKey(x.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }),
        value: x.kg,
        trend: trend[i],
      })),
      { goal: p.targetWeight || null },
    );
  }
}

// ---------- Profil ----------

function renderProfile() {
  const p = profile();
  const opt = (obj, val) =>
    Object.entries(obj)
      .map(([k, v]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${esc(v.label)}</option>`)
      .join('');

  $('#view-profile').innerHTML = `
    <article class="card">
      <h2>Dein Profil</h2>
      <form class="stack" data-form="profile" id="profile-form">
        <label>Name (optional)<input id="p-name" value="${esc(p.name)}" autocomplete="given-name"></label>
        <div class="grid-2">
          <label>Geschlecht<select id="p-sex">
            <option value="female" ${p.sex === 'female' ? 'selected' : ''}>Weiblich</option>
            <option value="male" ${p.sex === 'male' ? 'selected' : ''}>Männlich</option>
          </select></label>
          <label>Alter<input id="p-age" type="number" inputmode="numeric" min="14" max="100" value="${p.age}" required></label>
          <label>Größe (cm)<input id="p-height" type="number" inputmode="numeric" min="120" max="230" value="${p.height}" required></label>
          <label>Gewicht (kg)<input id="p-weight" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${currentWeight()}" required></label>
        </div>
        <label>Alltag & Sport<select id="p-activity">${opt(C.ACTIVITY_LEVELS, p.activity)}</select></label>
        <div class="grid-2">
          <label>Ziel<select id="p-goal">${opt(C.GOALS, p.goal)}</select></label>
          <label>Zielgewicht (kg)<input id="p-target" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${p.targetWeight || ''}"></label>
        </div>
        <button class="btn btn-block">${state.profile ? 'Profil speichern' : 'Profil anlegen'}</button>
      </form>
    </article>

    <article class="card" id="profile-results">${profileResults()}</article>

    <article class="card">
      <h3>Darstellung</h3>
      <div class="seg" role="group" aria-label="Farbschema">
        ${[
          ['system', 'System'],
          ['light', 'Hell'],
          ['dark', 'Dunkel'],
        ]
          .map(([id, l]) => `<button data-action="theme" data-id="${id}" aria-pressed="${state.settings.theme === id}">${l}</button>`)
          .join('')}
      </div>
    </article>

    <article class="card">
      <h3>Deine Daten</h3>
      <p class="small muted">Alles wird nur auf diesem Gerät gespeichert. Sichere deine Daten regelmäßig als Datei.</p>
      <div class="row">
        <button class="btn btn-sm btn-soft" data-action="export">Als Datei sichern</button>
        <button class="btn btn-sm btn-soft" data-action="copy-export">In Zwischenablage kopieren</button>
        <label class="btn btn-sm btn-ghost" style="color:var(--ink)">Sicherung laden<input type="file" id="import-file" accept="application/json,.json" hidden></label>
      </div>
      <div class="row">
        <button class="btn btn-sm btn-ghost" data-action="demo">Beispieldaten laden</button>
        <button class="btn btn-sm btn-ghost" style="color:var(--bad)" data-action="reset">Alle Daten löschen</button>
      </div>
    </article>

    <p class="small muted" style="padding-inline:4px">Die Berechnungen (Mifflin-St-Jeor-Formel, MET-Werte) sind Schätzungen und ersetzen keine ärztliche oder ernährungsfachliche Beratung.</p>`;
}

function profileResults() {
  const t = targets();
  const p = { ...profile(), weight: currentWeight() };
  const b = C.bmi(p.weight, p.height);
  const cat = C.bmiCategory(b);
  return `
    <h3>Dein Bedarf</h3>
    <dl class="equation">
      <dt>Grundumsatz (Ruhe)</dt><dd class="num">${fmt(t.bmr)} kcal</dd>
      <dt>Gesamtumsatz (mit Alltag)</dt><dd class="num">${fmt(t.tdee)} kcal</dd>
      <dt>${esc(C.GOALS[p.goal]?.label || '')}</dt><dd class="num">${fmt((C.GOALS[p.goal]?.delta) || 0)} kcal</dd>
      <dt class="total">Tagesziel</dt><dd class="num total">${fmt(t.kcal)} kcal</dd>
    </dl>
    <div class="nutri">
      <div><b>${fmt(t.protein)}</b><span>Eiweiß g</span></div>
      <div><b>${fmt(t.carbs)}</b><span>Kohlenh. g</span></div>
      <div><b>${fmt(t.fat)}</b><span>Fett g</span></div>
      <div><b>${fmt(t.water / 1000, 2)}</b><span>Wasser l</span></div>
    </div>
    <p class="small">BMI ${fmt(b, 1)} <span class="pill pill-${cat.level}">${cat.label}</span></p>
    <label>Eigenes Kalorienziel (überschreibt die Berechnung)
      <input id="custom-kcal" type="number" inputmode="numeric" min="800" max="6000" placeholder="automatisch" value="${state.settings.customKcal || ''}">
    </label>`;
}

function saveProfile() {
  const v = (id) => $(`#${id}`).value;
  const weight = num(v('p-weight'));
  state.profile = {
    name: v('p-name').trim(),
    sex: v('p-sex'),
    age: num(v('p-age')),
    height: num(v('p-height')),
    weight,
    activity: v('p-activity'),
    goal: v('p-goal'),
    targetWeight: num(v('p-target')) || null,
  };
  // Geändertes Gewicht als Messung für heute speichern
  if (weight && weight !== currentWeight()) setWeight(C.dateKey(), weight);
  S.save(state);
  $('#profile-results').innerHTML = profileResults();
  toast('Profil gespeichert – Ziele neu berechnet');
}

function setWeight(date, kg) {
  state.weights = state.weights.filter((w) => w.date !== date);
  state.weights.push({ date, kg });
  state.weights.sort((a, b) => a.date.localeCompare(b.date));
  if (state.profile) state.profile.weight = kg;
}

// ---------- Beispieldaten ----------

function loadDemo() {
  const pick = (name) => FOODS.find((f) => f.name === name);
  const entry = (name, amount) => {
    const f = pick(name);
    return { id: S.uid(), foodId: f.id, name: f.name, amount, per100: { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat }, ...C.scaleFood(f, amount) };
  };
  const menus = [
    { breakfast: [['Haferflocken', 60], ['Milch 1,5 %', 200], ['Banane', 120]], lunch: [['Hähnchenbrust', 150], ['Reis (gekocht)', 180], ['Brokkoli', 150]], dinner: [['Vollkornbrot', 100], ['Gouda', 30], ['Tomate', 100]], snacks: [['Skyr natur', 150], ['Apfel', 180]] },
    { breakfast: [['Skyr natur', 200], ['Heidelbeeren', 125], ['Granola', 40]], lunch: [['Nudeln (gekocht)', 250], ['Tomatensauce', 150], ['Parmesan', 10]], dinner: [['Lachs', 125], ['Kartoffeln (gekocht)', 200], ['Grüne Bohnen', 150]], snacks: [['Mandeln', 30]] },
    { breakfast: [['Vollkornbrötchen', 60], ['Frischkäse', 30], ['Ei (Größe M)', 120]], lunch: [['Linsen (gekocht)', 200], ['Karotte', 80], ['Olivenöl', 10]], dinner: [['Putenbrust', 150], ['Süßkartoffel (gekocht)', 200], ['Spinat', 100]], snacks: [['Proteinriegel', 60], ['Cappuccino', 200]] },
  ];
  const today = C.dateKey();
  state.profile = state.profile || { ...DEFAULT_PROFILE, name: '' };
  for (let i = 13; i >= 1; i--) {
    const key = C.addDays(today, -i);
    const menu = menus[i % menus.length];
    const day = S.emptyDay();
    for (const [meal, items] of Object.entries(menu)) day.meals[meal] = items.map(([n, g]) => entry(n, g));
    if (i % 4 === 1) day.meals.snacks.push(entry('Vollmilchschokolade', 50));
    day.water = 1500 + (i % 3) * 500;
    if (i % 2 === 0) {
      const minutes = 50;
      day.workouts.push({
        id: S.uid(),
        type: 'strength',
        name: i % 4 === 0 ? 'Ganzkörper 3×/Woche · Tag A' : 'Ganzkörper 3×/Woche · Tag B',
        minutes,
        kcal: C.metCalories(STRENGTH_MET, 72, minutes),
        exercises: [
          { id: 'squat', name: 'Kniebeuge', sets: [0, 1, 2].map(() => ({ reps: 10, weight: 50 + (13 - i) * 1.25 })) },
          { id: 'bench', name: 'Bankdrücken', sets: [0, 1, 2].map(() => ({ reps: 8, weight: 35 + (13 - i) })) },
          { id: 'row', name: 'Langhantelrudern', sets: [0, 1, 2].map(() => ({ reps: 10, weight: 40 })) },
        ],
      });
    } else if (i % 3 === 0) {
      day.workouts.push({ id: S.uid(), type: 'cardio', name: 'Joggen (8 km/h)', minutes: 30, kcal: C.metCalories(8.3, 72, 30) });
    }
    state.days[key] = day;
    if (i % 2 === 1) setWeight(key, Math.round((72.4 - (13 - i) * 0.12 + ((i * 7) % 5) * 0.1) * 10) / 10);
  }
  toast('Beispieldaten für die letzten 2 Wochen geladen');
  commit();
}

// ---------- Export / Import ----------

function exportJson() {
  return JSON.stringify({ app: 'kalorien', exportedAt: new Date().toISOString(), ...state }, null, 2);
}

// ---------------------------------------------------------------------------
// Ereignisse
// ---------------------------------------------------------------------------

document.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('[data-action]');
  const tab = ev.target.closest('.tab');
  if (tab) {
    ui.tab = tab.dataset.tab;
    render();
    window.scrollTo({ top: 0 });
    return;
  }
  if (!btn) return;
  const d = btn.dataset;
  const day = () => S.getDay(state, ui.date);

  switch (d.action) {
    case 'goto':
      ui.tab = d.tab;
      render();
      window.scrollTo({ top: 0 });
      break;
    case 'day-prev':
      ui.date = C.addDays(ui.date, -1);
      render();
      break;
    case 'day-next':
      ui.date = C.addDays(ui.date, 1);
      render();
      break;
    case 'day-today':
      ui.date = C.dateKey();
      render();
      break;

    // Essen
    case 'open-food':
      openFood(d.meal);
      break;
    case 'close-dialog':
      btn.closest('dialog').close();
      break;
    case 'food-tab':
      ui.foodTab = d.id;
      stopScan();
      renderFood();
      break;
    case 'food-cat':
      ui.foodCat = ui.foodCat === d.id ? null : d.id;
      document.querySelectorAll('[data-action="food-cat"]').forEach((c) => c.setAttribute('aria-pressed', c.dataset.id === ui.foodCat));
      renderFoodResults();
      break;
    case 'pick-food': {
      const f = findFood(d.id);
      if (f) pickFood(f);
      break;
    }
    case 'set-amount':
      ui.amount = num(d.g);
      renderFood();
      break;
    case 'food-back':
      if (ui.editing) $('#food-dialog').close();
      ui.selectedFood = null;
      renderFood();
      break;
    case 'food-save':
      saveFoodEntry();
      break;
    case 'edit-entry': {
      const e = day().meals[d.meal].find((x) => x.id === d.id);
      if (!e) break;
      const per100 = e.per100 || { kcal: (e.kcal / e.amount) * 100, protein: (e.protein / e.amount) * 100, carbs: (e.carbs / e.amount) * 100, fat: (e.fat / e.amount) * 100 };
      ui.foodMeal = d.meal;
      ui.editing = { meal: d.meal, entryId: e.id, name: e.name };
      ui.selectedFood = { id: e.foodId || e.id, name: e.name, ...per100 };
      ui.amount = e.amount;
      renderFood();
      $('#food-dialog').showModal();
      break;
    }
    case 'del-entry': {
      const list = day().meals[d.meal];
      const idx = list.findIndex((x) => x.id === d.id);
      if (idx < 0) break;
      const [removed] = list.splice(idx, 1);
      commit();
      toast(`${removed.name} entfernt`);
      break;
    }
    case 'copy-meal': {
      const src = S.peekDay(state, C.addDays(ui.date, -1)).meals[d.meal] || [];
      day().meals[d.meal] = src.map((e) => ({ ...e, id: S.uid() }));
      toast('Von gestern übernommen');
      commit();
      break;
    }
    case 'del-custom':
      if (await confirmDialog('Eigenes Lebensmittel löschen? Einträge im Tagebuch bleiben erhalten.')) {
        state.customFoods = state.customFoods.filter((f) => f.id !== d.id);
        S.save(state);
        renderFood();
      }
      break;
    case 'scan':
      startScan();
      break;

    // Wasser
    case 'water-add':
      day().water = Math.max(0, day().water + num(d.ml));
      commit();
      break;
    case 'water-set': {
      const ml = num(d.ml);
      day().water = day().water === ml ? ml - 250 : ml;
      commit();
      break;
    }

    // Training
    case 'del-workout': {
      const list = day().workouts;
      const idx = list.findIndex((w) => w.id === d.id);
      if (idx >= 0 && (await confirmDialog(`„${list[idx].name}“ löschen?`))) {
        list.splice(idx, 1);
        commit();
      }
      break;
    }
    case 'muscle':
      ui.muscle = d.id || null;
      render();
      break;
    case 'wo-start-free':
      startWorkout('Freies Training', []);
      break;
    case 'wo-start-one':
      startWorkout(exerciseById(d.id).name, [d.id]);
      break;
    case 'wo-start-plan': {
      const plan = PLANS.find((p) => p.id === d.plan);
      const pd = plan.days[num(d.day)];
      startWorkout(`${plan.name} · ${pd.name}`, pd.exercises);
      break;
    }
    case 'wo-add-ex':
      state.activeWorkout.exercises.push(newExercise($('#wo-add-ex').value));
      commit();
      break;
    case 'wo-del-ex':
      state.activeWorkout.exercises.splice(num(d.ex), 1);
      commit();
      break;
    case 'set-add': {
      const sets = state.activeWorkout.exercises[num(d.ex)].sets;
      const last = sets[sets.length - 1];
      sets.push({ reps: last?.reps ?? '', weight: last?.weight ?? '', done: false });
      commit();
      break;
    }
    case 'set-del':
      state.activeWorkout.exercises[num(d.ex)].sets.splice(num(d.set), 1);
      commit();
      break;
    case 'set-done': {
      const s = state.activeWorkout.exercises[num(d.ex)].sets[num(d.set)];
      s.done = !s.done;
      if (s.done) ui.rest = { end: Date.now() + REST_SECONDS * 1000 };
      commit();
      break;
    }
    case 'rest-stop':
      ui.rest = null;
      updateTimers();
      break;
    case 'wo-cancel':
      if (await confirmDialog('Laufendes Training verwerfen?', 'Verwerfen')) {
        state.activeWorkout = null;
        ui.rest = null;
        commit();
      }
      break;
    case 'wo-finish':
      finishWorkout();
      break;

    // Fortschritt
    case 'range':
      ui.range = num(d.n);
      render();
      break;
    case 'del-weight':
      state.weights = state.weights.filter((w) => w.date !== d.date);
      commit();
      break;

    // Profil
    case 'theme':
      state.settings.theme = d.id;
      commit();
      break;
    case 'export': {
      const blob = new Blob([exportJson()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `kalorien-sicherung-${C.dateKey()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      break;
    }
    case 'copy-export':
      try {
        await navigator.clipboard.writeText(exportJson());
        toast('Sicherung in die Zwischenablage kopiert');
      } catch {
        toast('Kopieren nicht möglich. Nutze „Als Datei sichern“.');
      }
      break;
    case 'demo':
      loadDemo();
      break;
    case 'reset':
      if (await confirmDialog('Wirklich alle Daten auf diesem Gerät löschen? Das lässt sich nicht rückgängig machen.', 'Alles löschen')) {
        state = S.defaultState();
        commit();
        toast('Alle Daten gelöscht');
      }
      break;
  }
});

document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('[data-form]');
  if (!form) return;
  ev.preventDefault();
  switch (form.dataset.form) {
    case 'off-search':
      onlineSearch($('#off-query').value);
      break;
    case 'custom-food': {
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
      state.customFoods.unshift(f);
      S.save(state);
      pickFood(f);
      break;
    }
    case 'cardio': {
      const act = CARDIO.find((a) => a.id === $('#cardio-act').value);
      const minutes = num($('#cardio-min').value);
      if (!act || minutes <= 0) {
        toast('Bitte eine Dauer eingeben.');
        return;
      }
      S.getDay(state, ui.date).workouts.push({
        id: S.uid(),
        type: 'cardio',
        name: act.name,
        minutes,
        kcal: C.metCalories(act.met, currentWeight(), minutes),
      });
      toast(`${act.name} eingetragen`);
      commit();
      break;
    }
    case 'weight': {
      const kg = num($('#weight-input').value);
      if (kg < 20 || kg > 400) {
        toast('Bitte ein Gewicht zwischen 20 und 400 kg eingeben.');
        return;
      }
      setWeight(C.dateKey(), kg);
      toast('Gewicht eingetragen');
      commit();
      break;
    }
    case 'profile':
      saveProfile();
      break;
  }
});

document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.id === 'food-search') renderFoodResults();
  if (t.id === 'food-amount' && ui.selectedFood) {
    ui.amount = num(t.value);
    $('#food-nutri').innerHTML = nutriHtml(C.scaleFood(ui.selectedFood, ui.amount));
    document.querySelectorAll('[data-action="set-amount"]').forEach((c) => c.setAttribute('aria-pressed', num(c.dataset.g) === ui.amount));
  }
  if (t.id === 'cardio-min') updateCardioPreview();
  if (t.dataset.field && state.activeWorkout) {
    const s = state.activeWorkout.exercises[num(t.dataset.ex)].sets[num(t.dataset.set)];
    s[t.dataset.field] = t.value === '' ? '' : num(t.value);
    S.save(state);
  }
});

document.addEventListener('change', async (ev) => {
  const t = ev.target;
  if (t.id === 'cardio-act') updateCardioPreview();
  if (t.id === 'custom-kcal') {
    const v = num(t.value);
    state.settings.customKcal = v >= 800 ? v : null;
    S.save(state);
    $('#profile-results').innerHTML = profileResults();
    toast(state.settings.customKcal ? `Tagesziel auf ${fmt(v)} kcal gesetzt` : 'Tagesziel wird automatisch berechnet');
  }
  if (t.id === 'import-file' && t.files[0]) {
    try {
      const data = JSON.parse(await t.files[0].text());
      if (!data || typeof data !== 'object' || !data.days) throw new Error('format');
      state = S.migrate(data);
      commit();
      toast('Sicherung geladen');
    } catch {
      toast('Die Datei ist keine gültige Sicherung dieser App.');
    }
    t.value = '';
  }
});

$('#food-dialog').addEventListener('close', () => {
  stopScan();
  ui.editing = null;
});

// Beim Wechsel zurück in die App: Datum aktualisieren, falls Mitternacht vorbei ist
let lastToday = C.dateKey();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const now = C.dateKey();
  if (now !== lastToday) {
    if (ui.date === lastToday) ui.date = now;
    lastToday = now;
    render();
  }
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => ui.tab === 'progress' && renderProgress(), 150);
});

if (location.hash) {
  const tab = location.hash.slice(1);
  if (['today', 'training', 'progress', 'profile'].includes(tab)) ui.tab = tab;
}

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
