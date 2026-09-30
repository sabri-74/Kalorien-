// Gemeinsamer Zustand, Hilfsfunktionen und Registries für Aktionen und Ansichten.

import * as C from './calc.js';
import * as S from './store.js';
import { icon } from './icons.js';
import { hydratePhotos } from './photos.js';
import { foodEmoji } from './emoji.js';

export const store = { state: S.load() };

export const ui = {
  tab: 'today',
  date: C.dateKey(),
};

export const DEFAULT_PROFILE = {
  name: '',
  sex: 'female',
  age: 30,
  height: 170,
  weight: 70,
  activity: 'light',
  goal: 'lose',
  targetWeight: 65,
};

// ---------- Formatierung ----------

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const fmt = (n, d = 0) => Number(n || 0).toLocaleString('de-DE', { maximumFractionDigits: d });
export const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export function dateLabel(key, long = false) {
  const today = C.dateKey();
  if (key === today) return 'Heute';
  if (key === C.addDays(today, -1)) return 'Gestern';
  if (key === C.addDays(today, 1)) return 'Morgen';
  return C.parseKey(key).toLocaleDateString('de-DE', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' });
}

export function amountLabel(e) {
  if (e.unit === 'portion') return `${fmt(e.amount, 2)} ${e.amount === 1 ? 'Portion' : 'Portionen'}`;
  return `${fmt(e.amount)} g`;
}

// Emoji auf farbigem Grund als Bild für Lebensmittel ohne Foto
const HUES = [152, 28, 210, 330, 45, 265, 190, 5];
export function avatar(name, photo, category) {
  if (photo) return `<span class="thumb"><img data-photo="${esc(photo)}" alt=""></span>`;
  const n = String(name || '?').trim();
  let h = 0;
  for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `<span class="thumb thumb-emoji" style="--h:${HUES[h % HUES.length]}" aria-hidden="true">${foodEmoji(n, category)}</span>`;
}

// ---------- Profil & Ziele ----------

export function profile() {
  return store.state.profile || DEFAULT_PROFILE;
}

export function currentWeight() {
  const w = store.state.weights;
  return w.length ? w[w.length - 1].kg : profile().weight;
}

export function targets() {
  const p = { ...profile(), weight: currentWeight() };
  const kcal = store.state.settings.customKcal || C.calorieTarget(p);
  return {
    kcal,
    ...C.macroTargets(kcal, p.weight, p.goal),
    water: C.waterTarget(p.weight),
    bmr: C.bmr(p),
    tdee: C.tdee(p),
  };
}

export function dayTotals(key) {
  const day = S.peekDay(store.state, key);
  const eaten = C.sumNutrients(S.dayEntries(day));
  const burned = day.workouts.reduce((s, w) => s + (w.kcal || 0), 0);
  return { day, eaten, burned };
}

export function setWeight(date, kg) {
  const s = store.state;
  s.weights = s.weights.filter((w) => w.date !== date);
  s.weights.push({ date, kg });
  s.weights.sort((a, b) => a.date.localeCompare(b.date));
  if (s.profile) s.profile.weight = kg;
}

/** Zuletzt verwendet (neueste zuerst, max. 24). */
export function rememberFood(f) {
  const s = store.state;
  const item = { id: f.id, name: f.name, brand: f.brand || '', kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, portion: f.portion, portionLabel: f.portionLabel };
  s.recentFoods = [item, ...s.recentFoods.filter((r) => r.id !== f.id)].slice(0, 24);
}

/** Eintrag im Tagebuch anlegen. */
export function addEntry(dateKey, meal, { name, amount, unit = 'g', base, photo, dishId, foodId, source }) {
  const entry = { id: S.uid(), name, amount, unit, base, ...C.scaleBase(base, amount, unit) };
  if (photo) entry.photo = photo;
  if (dishId) entry.dishId = dishId;
  if (foodId) entry.foodId = foodId;
  if (source) entry.source = source;
  S.getDay(store.state, dateKey).meals[meal].push(entry);
  return entry;
}

// ---------- Speichern & Rendern ----------

let renderFn = () => {};
export function setRenderer(fn) {
  renderFn = fn;
}

export function save() {
  if (!S.save(store.state)) toast('Speichern nicht möglich – der Browser-Speicher ist voll oder blockiert.');
}

export function commit() {
  save();
  renderFn();
}

export function afterRender(root) {
  hydratePhotos(root);
}

// ---------- Registries ----------

export const actions = {};
export const forms = {};
export const inputs = {};
export const views = {};

// ---------- Rückmeldungen ----------

let toastTimer;
/** Kurze Meldung; optional mit „Rückgängig“. */
export function toast(msg, undo) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button class="toast-undo" id="toast-undo">${icon('undo')}Rückgängig</button>` : ''}`;
  t.hidden = false;
  t.classList.remove('toast-in');
  void t.offsetWidth;
  t.classList.add('toast-in');
  clearTimeout(toastTimer);
  if (undo) {
    $('#toast-undo').onclick = () => {
      undo();
      t.hidden = true;
    };
  }
  toastTimer = setTimeout(() => (t.hidden = true), undo ? 5000 : 2600);
}

export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* nicht unterstützt */
  }
}

export function confirmDialog(text, okLabel = 'Löschen') {
  const dlg = $('#confirm-dialog');
  $('#confirm-text').textContent = text;
  $('#confirm-ok').textContent = okLabel;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
  });
}

// ---------- Sheet (Bottom-Sheet-Dialog) ----------

let sheetClose = null;
export function openSheet(title, html, { onClose, wide } = {}) {
  const dlg = $('#sheet');
  $('#sheet-title').textContent = title;
  $('#sheet-body').innerHTML = html;
  dlg.classList.toggle('sheet-wide', !!wide);
  sheetClose = onClose || null;
  if (!dlg.open) dlg.showModal();
  $('#sheet-body').scrollTop = 0;
  afterRender($('#sheet-body'));
}

export function setSheet(title, html) {
  if (title != null) $('#sheet-title').textContent = title;
  $('#sheet-body').innerHTML = html;
  $('#sheet-body').scrollTop = 0;
  afterRender($('#sheet-body'));
}

export function closeSheet() {
  const dlg = $('#sheet');
  if (dlg.open) dlg.close();
}

export function onSheetClosed() {
  const fn = sheetClose;
  sheetClose = null;
  fn?.();
}

export function sheetOpen() {
  return $('#sheet').open;
}

// ---------- Bausteine ----------

export function nutriGrid(n, big = false) {
  return `<div class="nutri ${big ? 'nutri-big' : ''}">
    <div><b>${fmt(n.kcal)}</b><span>kcal</span></div>
    <div><b>${fmt(n.protein, 1)}</b><span>Eiweiß</span></div>
    <div><b>${fmt(n.carbs, 1)}</b><span>Kohlenh.</span></div>
    <div><b>${fmt(n.fat, 1)}</b><span>Fett</span></div>
  </div>`;
}

export function macroLine(n) {
  return `E ${fmt(n.protein)} · K ${fmt(n.carbs)} · F ${fmt(n.fat)}`;
}

export function mealOptions(selected) {
  return S.MEALS.map((m) => `<option value="${m.id}" ${m.id === selected ? 'selected' : ''}>${m.label}</option>`).join('');
}

export function defaultMeal() {
  return C.mealForHour(new Date().getHours());
}

export const dishTotalsCached = (d) => C.dishTotals(d);

export { C, S, icon };
