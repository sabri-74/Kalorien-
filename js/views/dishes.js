// Gerichte: eigene Rezepte zusammenstellen, aus Mahlzeiten oder KI-Fotos
// speichern und mit einem Tipp wieder eintragen.

import {
  store, ui, C, S, $, esc, fmt, num, icon, views, actions, inputs, forms, openSheet, setSheet, closeSheet, commit, save, toast,
  confirmDialog, avatar, nutriGrid, macroLine, defaultMeal, haptic,
} from '../core.js';
import { FOODS, searchFoods } from '../foods.js';
import { pickDish } from './food.js';
import { prepareImage, putPhoto, deletePhoto } from '../photos.js';

const TEMPLATES = [
  { name: 'Porridge mit Beeren', servings: 1, items: [['Haferflocken', 60], ['Milch 1,5 %', 250], ['Heidelbeeren', 100], ['Honig', 10]] },
  { name: 'Hähnchen mit Reis & Brokkoli', servings: 1, items: [['Hähnchenbrust', 150], ['Reis (gekocht)', 180], ['Brokkoli', 150], ['Olivenöl', 10]] },
  { name: 'Spaghetti Bolognese', servings: 4, items: [['Nudeln (roh)', 400], ['Rinderhack', 500], ['Tomatensauce', 500], ['Zwiebel', 60], ['Olivenöl', 20], ['Parmesan', 40]] },
  { name: 'Griechischer Salat', servings: 1, items: [['Gurke', 150], ['Tomate', 160], ['Feta', 50], ['Paprika (rot)', 75], ['Zwiebel', 30], ['Olivenöl', 10]] },
  { name: 'Skyr-Bowl', servings: 1, items: [['Skyr natur', 250], ['Banane', 120], ['Granola', 30]] },
];

const ing = (f, amount) => {
  const base = { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat };
  return { id: S.uid(), name: f.name, amount, unit: 'g', base, ...C.scaleBase(base, amount, 'g') };
};

function templateDish(t) {
  return {
    name: t.name,
    servings: t.servings,
    ingredients: t.items.map(([n, g]) => ing(FOODS.find((f) => f.name === n), g)),
  };
}

// ---------- Übersicht ----------

let dishQuery = '';

function dishCard(d) {
  const t = C.dishTotals(d);
  return `<article class="dish-card">
    <button class="dish-open" data-action="dish-edit" data-id="${d.id}" aria-label="${esc(d.name)} bearbeiten">
      ${avatar(d.name, d.photo).replace('class="thumb', 'class="thumb thumb-xl')}
      <span class="dish-info">
        <b>${esc(d.name)}</b>
        <small>${fmt(t.perServing.kcal)} kcal pro Portion${d.servings > 1 ? ` · ${d.servings} Portionen` : ''}</small>
        <small class="muted">${macroLine(t.perServing)}${d.uses ? ` · ${d.uses}× gegessen` : ''}</small>
      </span>
    </button>
    <button class="btn btn-primary btn-sm dish-log" data-action="dish-log" data-id="${d.id}" aria-label="${esc(d.name)} eintragen">${icon('plus')}<span>Eintragen</span></button>
  </article>`;
}

views.dishes = (root) => {
  const s = store.state;
  const q = dishQuery.toLowerCase();
  const list = [...s.dishes]
    .filter((d) => !q || d.name.toLowerCase().includes(q))
    .sort((a, b) => (b.lastUsed || b.createdAt || 0) - (a.lastUsed || a.createdAt || 0));
  root.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">Rezepte & Lieblingsessen</p><h1>Gerichte</h1></div>
      <button class="btn btn-primary" data-action="dish-new">${icon('plus')}Neu</button>
    </header>
    ${
      s.dishes.length
        ? `${s.dishes.length > 4 ? `<label class="search-box">${icon('search')}<input id="dish-search" type="search" placeholder="Gericht suchen" value="${esc(dishQuery)}" aria-label="Gericht suchen"></label>` : ''}
           <div class="dish-list">${list.map(dishCard).join('') || '<p class="empty-note">Kein Gericht gefunden.</p>'}</div>`
        : `<section class="empty-hero">
            <span class="empty-icon">${icon('pot')}</span>
            <h2>Einmal anlegen, immer wieder eintragen</h2>
            <p>Speichere Gerichte, die du öfter isst – dein Frühstück, Omas Suppe oder die Kantinen-Bowl. Danach reicht ein Tipp.</p>
            <div class="ways">
              <button class="way" data-action="dish-new">${icon('pen')}<b>Selbst zusammenstellen</b><small>Zutaten aus der Datenbank wählen</small></button>
              <button class="way" data-action="ai-open" data-mode="photo">${icon('camera')}<b>Per Foto erkennen</b><small>Beim Eintragen „Als Gericht speichern“ ankreuzen</small></button>
              <button class="way" data-action="goto" data-tab="today">${icon('save')}<b>Aus dem Tagebuch</b><small>Bei einer Mahlzeit „Als Gericht speichern“</small></button>
            </div>
          </section>`
    }
    <section>
      <h2 class="section-title">Vorlagen</h2>
      <p class="hint">Tipp auf eine Vorlage, pass sie an und speichere sie als dein Gericht.</p>
      <div class="hscroll">${TEMPLATES.map((t, i) => {
        const tot = C.dishTotals(templateDish(t));
        return `<button class="dish-mini" data-action="dish-template" data-i="${i}">${avatar(t.name)}<b>${esc(t.name)}</b><small>${fmt(tot.perServing.kcal)} kcal / Portion</small></button>`;
      }).join('')}</div>
    </section>`;
};

inputs['dish-search'] = (el) => {
  dishQuery = el.value;
  const pos = el.selectionStart;
  commit();
  const again = $('#dish-search');
  again?.focus();
  again?.setSelectionRange(pos, pos);
};

actions['dish-log'] = (d) => {
  const dish = store.state.dishes.find((x) => x.id === d.id);
  if (dish) pickDish(dish, defaultMeal());
};

// ---------- Editor ----------

let draft = null; // { id, name, servings, photo, photoData, ingredients }
let pickQuery = '';
let pickItem = null;

function openEditor(d) {
  draft = { id: d.id || null, name: d.name || '', servings: d.servings || 1, photo: d.photo || null, photoData: null, ingredients: (d.ingredients || []).map((i) => ({ ...i })) };
  openSheet(draft.id ? 'Gericht bearbeiten' : 'Neues Gericht', editorHtml(), { wide: true });
}

function editorHtml() {
  const t = C.dishTotals(draft);
  const photo = draft.photoData
    ? `<span class="thumb thumb-xl"><img src="${draft.photoData}" alt=""></span>`
    : draft.photo
      ? avatar(draft.name, draft.photo).replace('class="thumb', 'class="thumb thumb-xl')
      : `<span class="thumb thumb-xl thumb-add">${icon('camera')}</span>`;
  return `
    <div class="dish-edit-head">
      <button class="photo-slot" data-action="dish-photo" aria-label="Foto wählen">${photo}</button>
      <label class="field grow">Name<input id="dish-name" value="${esc(draft.name)}" placeholder="z. B. Mein Frühstück" autocomplete="off"></label>
    </div>
    <div class="field">
      <span>Portionen im Rezept</span>
      <div class="stepper stepper-sm">
        <button class="step-btn" data-action="dish-servings" data-dir="-1" aria-label="Weniger Portionen">${icon('minus')}</button>
        <label class="step-field"><input id="dish-servings" type="number" inputmode="numeric" min="1" value="${draft.servings}" aria-label="Portionen"><span>${draft.servings === 1 ? 'Portion' : 'Portionen'}</span></label>
        <button class="step-btn" data-action="dish-servings" data-dir="1" aria-label="Mehr Portionen">${icon('plus')}</button>
      </div>
    </div>
    <div>
      <h4 class="eyebrow">Zutaten${draft.ingredients.length ? ` · ${fmt(t.grams)} g gesamt` : ''}</h4>
      ${
        draft.ingredients.length
          ? `<ul class="rows">${draft.ingredients
              .map(
                (i, idx) => `<li class="row ing-row">
                  ${avatar(i.name)}
                  <span class="row-main"><b>${esc(i.name)}</b><small id="ing-kcal-${idx}">${fmt(i.kcal)} kcal</small></span>
                  <label class="step-field step-field-sm"><input id="ing-amount-${idx}" data-input="ing-amount" type="number" inputmode="decimal" min="0" value="${i.amount}" aria-label="Menge ${esc(i.name)}"><span>${i.unit === 'portion' ? 'Port.' : 'g'}</span></label>
                  <button class="icon-btn" data-action="ing-remove" data-i="${idx}" aria-label="${esc(i.name)} entfernen">${icon('close')}</button>
                </li>`,
              )
              .join('')}</ul>`
          : '<p class="empty-note">Noch keine Zutaten. Füg die erste hinzu.</p>'
      }
      <button class="btn btn-soft btn-block" data-action="ing-add">${icon('plus')}Zutat hinzufügen</button>
    </div>
    <div class="dish-sum">
      <div class="dish-sum-head"><b>Pro Portion</b><span>Gesamt ${fmt(t.total.kcal)} kcal</span></div>
      <div id="dish-nutri">${nutriGrid(t.perServing, true)}</div>
    </div>
    <div class="sheet-actions sheet-actions-sticky">
      ${draft.id ? `<button class="btn btn-ghost btn-danger-text" data-action="dish-delete">${icon('trash')}</button>` : ''}
      <button class="btn btn-ghost" data-action="dish-save" data-log="0">Speichern</button>
      <button class="btn btn-primary grow" data-action="dish-save" data-log="1">Speichern & eintragen</button>
    </div>`;
}

function syncDraft() {
  const n = $('#dish-name');
  if (n) draft.name = n.value;
  const sv = $('#dish-servings');
  if (sv) draft.servings = Math.max(1, Math.round(num(sv.value)) || 1);
}

function refreshSum() {
  const t = C.dishTotals(draft);
  $('#dish-nutri').innerHTML = nutriGrid(t.perServing, true);
  const head = $('.dish-sum-head span');
  if (head) head.textContent = `Gesamt ${fmt(t.total.kcal)} kcal`;
}

actions['dish-new'] = () => openEditor({});
actions['dish-template'] = (d) => openEditor(templateDish(TEMPLATES[Number(d.i)]));
actions['dish-edit'] = (d) => {
  const dish = store.state.dishes.find((x) => x.id === d.id);
  if (dish) openEditor(dish);
};

actions['dish-servings'] = (d) => {
  syncDraft();
  draft.servings = Math.max(1, draft.servings + Number(d.dir));
  $('#dish-servings').value = draft.servings;
  $('#dish-servings').nextElementSibling.textContent = draft.servings === 1 ? 'Portion' : 'Portionen';
  refreshSum();
};
inputs['dish-servings'] = () => {
  syncDraft();
  refreshSum();
};

inputs['ing-amount'] = (el) => {
  const idx = Number(el.id.split('-').pop());
  const i = draft.ingredients[idx];
  i.amount = num(el.value);
  Object.assign(i, C.scaleBase(i.base, i.amount, i.unit));
  $(`#ing-kcal-${idx}`).textContent = `${fmt(i.kcal)} kcal`;
  refreshSum();
};

actions['ing-remove'] = (d) => {
  syncDraft();
  draft.ingredients.splice(Number(d.i), 1);
  setSheet(null, editorHtml());
};

actions['dish-photo'] = () => {
  syncDraft();
  const input = $('#dish-photo-input');
  input.value = '';
  input.click();
};

inputs['dish-photo-input'] = async (el) => {
  const file = el.files?.[0];
  if (!file || !draft) return;
  try {
    draft.photoData = (await prepareImage(file)).thumb;
    setSheet(null, editorHtml());
  } catch {
    toast('Das Foto konnte nicht gelesen werden.');
  }
};

actions['dish-save'] = async (d) => {
  syncDraft();
  const s = store.state;
  if (!draft.name.trim()) {
    toast('Gib dem Gericht einen Namen.');
    $('#dish-name').focus();
    return;
  }
  if (!draft.ingredients.length) {
    toast('Füg mindestens eine Zutat hinzu.');
    return;
  }
  let photo = draft.photo;
  if (draft.photoData) {
    if (photo) deletePhoto(photo);
    photo = `p-${S.uid()}`;
    await putPhoto(photo, draft.photoData);
  }
  const data = { name: draft.name.trim(), servings: draft.servings, photo, ingredients: draft.ingredients };
  let dish;
  if (draft.id) {
    dish = s.dishes.find((x) => x.id === draft.id);
    Object.assign(dish, data);
  } else {
    dish = { id: `d-${S.uid()}`, ...data, uses: 0, createdAt: Date.now() };
    s.dishes.unshift(dish);
  }
  save();
  haptic(18);
  if (d.log === '1') {
    commit();
    pickDish(dish, defaultMeal());
  } else {
    closeSheet();
    toast(`„${dish.name}“ gespeichert`);
    commit();
  }
};

actions['dish-delete'] = async () => {
  const s = store.state;
  const idx = s.dishes.findIndex((x) => x.id === draft.id);
  if (idx < 0) return;
  closeSheet();
  if (!(await confirmDialog(`„${s.dishes[idx].name}“ löschen? Einträge im Tagebuch bleiben erhalten.`))) return;
  const [removed] = s.dishes.splice(idx, 1);
  commit();
  toast('Gericht gelöscht', () => {
    store.state.dishes.splice(idx, 0, removed);
    commit();
  });
};

// ---------- Zutat auswählen ----------

function pickHtml() {
  const s = store.state;
  const pool = [...s.customFoods, ...FOODS];
  const list = pickQuery ? searchFoods(pool, pickQuery).slice(0, 40) : [...s.recentFoods, ...pool.filter((f) => !s.recentFoods.some((r) => r.id === f.id))].slice(0, 30);
  return `
    <label class="search-box">${icon('search')}<input id="ing-search" type="search" placeholder="Zutat suchen" value="${esc(pickQuery)}" autocomplete="off" aria-label="Zutat suchen"></label>
    <ul class="rows" id="ing-results">${list
      .map((f) => `<li><button class="row" data-action="ing-pick" data-id="${esc(f.id)}">${avatar(f.name)}<span class="row-main"><b>${esc(f.name)}</b><small>${fmt(f.kcal)} kcal / 100 g</small></span><span class="row-add">${icon('plus')}</span></button></li>`)
      .join('')}</ul>
    <div class="sheet-actions sheet-actions-sticky"><button class="btn btn-ghost btn-block" data-action="ing-back">Zurück zum Gericht</button></div>`;
}

actions['ing-add'] = () => {
  syncDraft();
  pickQuery = '';
  setSheet('Zutat hinzufügen', pickHtml());
  setTimeout(() => $('#ing-search')?.focus({ preventScroll: true }), 50);
};

inputs['ing-search'] = (el) => {
  pickQuery = el.value;
  const tmp = document.createElement('div');
  tmp.innerHTML = pickHtml();
  $('#ing-results').replaceWith(tmp.querySelector('#ing-results'));
};

actions['ing-back'] = () => setSheet(draft.id ? 'Gericht bearbeiten' : 'Neues Gericht', editorHtml());

actions['ing-pick'] = (d) => {
  const s = store.state;
  const f = [...s.customFoods, ...FOODS, ...s.recentFoods].find((x) => x.id === d.id);
  if (!f) return;
  pickItem = f;
  const g = f.portion || 100;
  setSheet('Menge', `
    <div class="pick-head">${avatar(f.name)}<div class="row-main"><b class="pick-name">${esc(f.name)}</b><small>${fmt(f.kcal)} kcal / 100 g</small></div></div>
    <form class="stack" data-form="ing-amount">
      <div class="chips">${[...new Set([f.portion, 50, 100, 200].filter(Boolean))].map((v) => `<button type="button" class="chip" data-action="ing-chip" data-v="${v}">${fmt(v)} g${v === f.portion && f.portionLabel ? ` (${esc(f.portionLabel)})` : ''}</button>`).join('')}</div>
      <label class="step-field"><input id="ing-grams" type="number" inputmode="decimal" min="1" value="${g}" aria-label="Gramm"><span>Gramm</span></label>
      <div class="sheet-actions"><button type="button" class="btn btn-ghost" data-action="ing-add">Zurück</button><button class="btn btn-primary">Zum Gericht hinzufügen</button></div>
    </form>`);
};

actions['ing-chip'] = (d) => {
  $('#ing-grams').value = d.v;
};

forms['ing-amount'] = () => {
  const g = num($('#ing-grams').value);
  if (g <= 0 || !pickItem) return;
  draft.ingredients.push(ing(pickItem, g));
  setSheet(draft.id ? 'Gericht bearbeiten' : 'Neues Gericht', editorHtml());
};

// ---------- Aus dem Tagebuch ----------

actions['meal-to-dish'] = (d) => {
  const entries = S.peekDay(store.state, ui.date).meals[d.meal] || [];
  const label = S.MEALS.find((m) => m.id === d.meal)?.label;
  openEditor({
    name: label === 'Snacks' ? 'Meine Snacks' : `Mein ${label}`,
    servings: 1,
    photo: entries.find((e) => e.photo)?.photo || null,
    ingredients: entries.map((e) => ({ id: S.uid(), name: e.name, amount: e.amount, unit: e.unit, base: e.base, ...C.scaleBase(e.base, e.amount, e.unit) })),
  });
};

export { closeSheet };
