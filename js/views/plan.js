// KI-Essensplaner: Gerichte, die den Tagesbedarf decken, plus günstige
// Einkaufsliste für deutsche Supermärkte mit Links zum Markt.

import {
  store, ui, C, S, $, esc, fmt, num, views, actions, forms, commit, save, toast, haptic, targets, addEntry, avatar, confirmDialog,
} from '../core.js';
import { createMealPlan, aiStatus, aiErrorText } from '../ai.js';
import * as P from '../mealplan.js';
import { MEAL_META } from '../emoji.js';
import { confetti } from '../fx.js';

const pl = { sub: 'plan', day: 0, form: null, busy: false, error: '', controller: null };
const euro = (v) => `${Number(v || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function form() {
  if (!pl.form) {
    const last = store.state.mealPlan?.params;
    pl.form = { days: last?.days || 3, store: last?.store || 'any', budget: last?.budget || 8, diet: last?.diet || 'all', wish: last?.wish || '' };
  }
  return pl.form;
}

export function openPlan(sub = 'plan') {
  pl.sub = sub;
  ui.tab = 'plan';
  commit();
  window.scrollTo({ top: 0 });
}
actions['plan-open'] = (d) => {
  if (document.querySelector('#sheet').open) document.querySelector('#sheet').close();
  openPlan(d.sub || 'plan');
};

// ---------- Ansicht ----------

views.plan = (root) => {
  const s = store.state;
  const open = s.shopping.filter((i) => !i.done).length;
  root.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow"><button class="link-inline" data-action="goto" data-tab="today">‹ Heute</button> · 🛒 Planen & sparen</p><h1>Essensplan</h1></div>
    </header>
    <div class="seg seg-block" role="group" aria-label="Bereich">
      <button data-action="plan-sub" data-id="plan" aria-pressed="${pl.sub === 'plan'}">🗓️ Gerichte</button>
      <button data-action="plan-sub" data-id="list" aria-pressed="${pl.sub === 'list'}">🧾 Einkaufsliste${open ? ` (${open})` : ''}</button>
    </div>
    ${pl.sub === 'list' ? listHtml() : pl.busy ? loadingHtml() : s.mealPlan && !pl.showForm ? planHtml() : formHtml()}`;
  if (pl.sub === 'plan' && !pl.busy && (!s.mealPlan || pl.showForm)) setTimeout(checkProvider, 0);
};

actions['plan-sub'] = (d) => {
  pl.sub = d.id;
  commit();
};

// ---------- Formular ----------

function formHtml() {
  const f = form();
  const t = targets();
  return `
    <article class="card">
      <div class="tool-hero tool-plan">
        <span class="tool-hero-emoji" aria-hidden="true">🛒</span>
        <div><h3>KI-Essensplaner</h3><p>Gerichte, die deinen Tagesbedarf decken – mit günstiger Einkaufsliste für deinen Supermarkt.</p></div>
      </div>
      <div class="chips chips-wrap">
        <span class="pill pill-info">🔥 ${fmt(t.kcal)} kcal</span><span class="pill pill-info">💪 ${fmt(t.protein)} g Eiweiß</span>
        <span class="pill pill-info">🍞 ${fmt(t.carbs)} g KH</span><span class="pill pill-info">🥑 ${fmt(t.fat)} g Fett</span>
      </div>
      ${pl.error ? `<div class="notice"><b>🙈 Das hat nicht geklappt</b><p>${esc(pl.error)}</p></div>` : ''}
      <div id="plan-provider"></div>
      <form class="stack" data-form="plan-create">
        <div class="field"><span>Für wie viele Tage?</span>
          <div class="seg seg-block">${[1, 3, 7].map((n) => `<button type="button" data-action="plan-set" data-k="days" data-v="${n}" aria-pressed="${f.days === n}">${n} ${n === 1 ? 'Tag' : 'Tage'}</button>`).join('')}</div>
        </div>
        <div class="field"><span>Wo kaufst du ein?</span>
          <div class="store-grid">${Object.entries(P.STORES).map(([id, st]) => `<button type="button" class="store-btn ${id === 'any' ? 'store-any' : ''}" data-action="plan-set" data-k="store" data-v="${id}" aria-pressed="${f.store === id}"><span aria-hidden="true">${st.emoji}</span>${esc(st.label)}</button>`).join('')}</div>
        </div>
        <div class="grid-2">
          <label class="field">Budget pro Tag
            <span class="step-field step-field-sm"><input id="plan-budget" type="number" inputmode="decimal" min="3" max="50" step="0.5" value="${f.budget}" aria-label="Budget in Euro pro Tag"><span>€</span></span>
          </label>
          <div class="field"><span>Ernährung</span>
            <select id="plan-diet" aria-label="Ernährung">${Object.entries(P.DIETS).map(([id, l]) => `<option value="${id}" ${f.diet === id ? 'selected' : ''}>${l}</option>`).join('')}</select>
          </div>
        </div>
        <label class="field">Wünsche (optional)<input id="plan-wish" value="${esc(f.wish)}" placeholder="z. B. viel Hähnchen, keine Pilze, Meal-Prep"></label>
        <button class="btn btn-primary btn-lg btn-block">✨ Plan erstellen</button>
        ${store.state.mealPlan ? '<button type="button" class="btn btn-ghost btn-block" data-action="plan-cancel-form">Zurück zum aktuellen Plan</button>' : ''}
        <p class="hint center">Preise sind Schätzungen der KI für typische Eigenmarken – im Laden können sie abweichen.</p>
      </form>
    </article>`;
}

actions['plan-set'] = (d) => {
  syncForm();
  const f = form();
  f[d.k] = d.k === 'days' ? Number(d.v) : d.v;
  document.querySelectorAll(`[data-action="plan-set"][data-k="${d.k}"]`).forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === String(d.v)));
  haptic(6);
};
actions['plan-new'] = () => {
  pl.showForm = true;
  pl.error = '';
  commit();
  setTimeout(checkProvider, 0);
};
actions['plan-cancel-form'] = () => {
  pl.showForm = false;
  commit();
};

function syncForm() {
  const f = form();
  if ($('#plan-budget')) f.budget = Math.max(3, num($('#plan-budget').value) || 8);
  if ($('#plan-diet')) f.diet = $('#plan-diet').value;
  if ($('#plan-wish')) f.wish = $('#plan-wish').value.trim();
}

async function checkProvider() {
  const st = await aiStatus(store.state.settings.apiKey);
  const box = $('#plan-provider');
  if (box && !st.provider) {
    box.innerHTML = `<div class="notice"><b>✨ KI einrichten</b><p>Für den Essensplaner braucht die App einen Claude-API-Schlüssel. Du hinterlegst ihn einmal im Profil.</p><button class="btn btn-soft btn-sm" data-action="goto-ai-settings">Jetzt einrichten</button></div>`;
  }
}

function loadingHtml() {
  const f = form();
  return `<article class="card"><div class="ai-loading">
    <div class="ai-orb"><span aria-hidden="true">🛒</span></div>
    <h3>Die KI plant ${f.days === 1 ? 'deinen Tag' : `deine ${f.days} Tage`} …</h3>
    <p class="hint">Sie stellt Gerichte für deinen Bedarf zusammen und sucht günstige Zutaten${f.store !== 'any' ? ` bei ${P.STORES[f.store].label}` : ''}. Das dauert bei mehreren Tagen bis zu einer Minute.</p>
    <div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
    <button class="btn btn-ghost" data-action="plan-abort">Abbrechen</button>
  </div></article>`;
}

actions['plan-abort'] = () => pl.controller?.abort();

forms['plan-create'] = async () => {
  syncForm();
  const f = form();
  const t = targets();
  pl.busy = true;
  pl.error = '';
  commit();
  pl.controller = new AbortController();
  try {
    const raw = await createMealPlan({
      apiKey: store.state.settings.apiKey, signal: pl.controller.signal,
      days: f.days, store: f.store, storeLabel: P.STORES[f.store].label, budget: f.budget, diet: f.diet, dietLabel: P.DIETS[f.diet], wish: f.wish,
      targets: t,
    });
    const plan = P.normalizeMealPlan(raw);
    if (!plan.days.length) throw Object.assign(new Error('leer'), { code: 'invalid' });
    const s = store.state;
    s.mealPlan = { ...plan, params: { ...f }, createdAt: Date.now() };
    s.shopping = [...s.shopping.filter((i) => i.source !== 'plan'), ...plan.shopping.map((i) => ({ ...i, id: S.uid(), done: false, source: 'plan' }))];
    pl.day = 0;
    pl.showForm = false;
    confetti({ emojis: ['🛒', '🥗', '💶', '✨'] });
    toast(`🗓️ Plan für ${f.days} ${f.days === 1 ? 'Tag' : 'Tage'} fertig – ${plan.shopping.length} Artikel auf der Einkaufsliste`);
  } catch (e) {
    if (e.code !== 'cancelled') pl.error = aiErrorText(e);
  } finally {
    pl.busy = false;
    pl.controller = null;
    commit();
    if (!store.state.mealPlan || pl.showForm) checkProvider();
  }
};

// ---------- Plan anzeigen ----------

function planHtml() {
  const plan = store.state.mealPlan;
  const t = targets();
  const day = plan.days[Math.min(pl.day, plan.days.length - 1)];
  const tot = P.dayPlanTotals(day);
  const kcalPct = Math.round((tot.kcal / t.kcal) * 100);
  const protPct = Math.round((tot.protein / t.protein) * 100);
  const shopTotal = P.shoppingTotal(store.state.shopping.filter((i) => i.source === 'plan'));
  return `
    <article class="card plan-summary">
      <div class="plan-stats">
        <div><span aria-hidden="true">🔥</span><b>${fmt(tot.kcal)}</b><small>kcal · ${kcalPct} % vom Bedarf</small></div>
        <div><span aria-hidden="true">💪</span><b>${fmt(tot.protein)} g</b><small>Eiweiß · ${protPct} %</small></div>
        <div><span aria-hidden="true">💶</span><b>${euro(tot.price)}</b><small>pro Tag (ca.)</small></div>
        <div><span aria-hidden="true">🛒</span><b>${euro(shopTotal)}</b><small>Einkauf gesamt</small></div>
      </div>
      <div class="cover-bar" aria-label="Kalorienbedarf zu ${kcalPct} Prozent gedeckt"><i style="width:${Math.min(100, kcalPct)}%"></i></div>
      ${plan.days.length > 1 ? `<div class="chips">${plan.days.map((d, i) => `<button class="chip" data-action="plan-day" data-i="${i}" aria-pressed="${i === pl.day}">${esc(d.title)}</button>`).join('')}</div>` : ''}
      ${plan.tip ? `<p class="hint">💡 ${esc(plan.tip)}</p>` : ''}
      <div class="sheet-actions">
        <button class="btn btn-primary" data-action="plan-log-day">✅ Ganzen Tag eintragen</button>
        <button class="btn btn-soft" data-action="plan-sub" data-id="list">🧾 Einkaufen</button>
      </div>
    </article>
    ${day.meals.map((m, i) => mealHtml(m, i)).join('')}
    <div class="sheet-actions">
      <button class="btn btn-ghost" data-action="plan-new">🔄 Neuer Plan</button>
      <button class="btn btn-soft" data-action="plan-sub" data-id="list">🛒 Zur Einkaufsliste</button>
    </div>`;
}

function mealHtml(m, i) {
  const hue = MEAL_META[m.slot]?.hue || 'lunch';
  return `<article class="card plan-meal meal meal-${hue}" style="--i:${i}">
    <header class="meal-head">
      <span class="meal-emoji plan-emoji" aria-hidden="true">${esc(m.emoji)}</span>
      <div class="grow">
        <p class="eyebrow">${MEAL_META[m.slot]?.emoji || ''} ${P.SLOTS[m.slot]}</p>
        <h3>${esc(m.name)}</h3>
        <p class="sub">⏱️ ${fmt(m.minutes)} Min. · 💶 ca. ${euro(m.price)}</p>
      </div>
    </header>
    <div class="plan-macros"><span>🔥 <b>${fmt(m.kcal)}</b> kcal</span><span>💪 ${fmt(m.protein)} g</span><span>🍞 ${fmt(m.carbs)} g</span><span>🥑 ${fmt(m.fat)} g</span></div>
    <details class="plan-details">
      <summary>🛒 Zutaten & 👩‍🍳 Zubereitung</summary>
      <ul class="rows">${m.ingredients.map((g) => `<li class="row">${avatar(g.name)}<span class="row-main"><b>${esc(g.name)}</b><small>${esc(g.amount)}</small></span></li>`).join('')}</ul>
      ${m.steps.length ? `<ol class="steps">${m.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    </details>
    <div class="sheet-actions">
      <button class="btn btn-ghost" data-action="plan-save-dish" data-i="${i}">💾 Merken</button>
      <button class="btn btn-primary" data-action="plan-log" data-i="${i}">✅ Eintragen</button>
    </div>
  </article>`;
}

const currentDay = () => store.state.mealPlan.days[Math.min(pl.day, store.state.mealPlan.days.length - 1)];
const logMeal = (m) =>
  addEntry(ui.date, m.slot, { name: m.name, amount: 1, unit: 'portion', base: { kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat }, source: 'plan' });

actions['plan-day'] = (d) => {
  pl.day = Number(d.i);
  commit();
};
actions['plan-log'] = (d) => {
  const m = currentDay().meals[Number(d.i)];
  logMeal(m);
  haptic(20);
  toast(`${m.emoji} ${m.name} eingetragen`);
  commit();
};
actions['plan-log-day'] = () => {
  const day = currentDay();
  day.meals.forEach(logMeal);
  haptic(30);
  confetti({ emojis: day.meals.map((m) => m.emoji) });
  toast(`✅ ${day.meals.length} Gerichte für ${ui.date === C.dateKey() ? 'heute' : 'den gewählten Tag'} eingetragen`);
  commit();
};
actions['plan-save-dish'] = (d) => {
  const m = currentDay().meals[Number(d.i)];
  const base = { kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat };
  store.state.dishes.unshift({
    id: `d-${S.uid()}`, name: m.name, servings: 1, photo: null, uses: 0, createdAt: Date.now(),
    ingredients: [{ id: S.uid(), name: m.name, amount: 1, unit: 'portion', base, ...base }],
    steps: [`Zutaten: ${m.ingredients.map((g) => `${g.name} (${g.amount})`).join(', ')}`, ...m.steps],
  });
  toast(`💾 „${m.name}“ in deinen Gerichten gespeichert`);
  commit();
};

// ---------- Einkaufsliste ----------

function listHtml() {
  const items = store.state.shopping;
  const done = items.filter((i) => i.done).length;
  const stores = [...new Set(items.filter((i) => !i.done).map((i) => i.store))];
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  return `
    <article class="card shop-head">
      <div class="shop-progress">
        <div class="grow"><b>${done} von ${items.length}</b> im Wagen 🛒<p class="sub">Gesamt ca. ${euro(P.shoppingTotal(items))} · noch offen ${euro(P.shoppingTotal(items, true))}</p></div>
        <span class="shop-pct">${pct}%</span>
      </div>
      <div class="cover-bar"><i style="width:${pct}%"></i></div>
      ${stores.length ? `<div class="chips chips-wrap">${stores.map((st) => `<a class="chip chip-strong" href="${P.storeMapUrl(st)}" target="_blank" rel="noopener">📍 ${esc(st === 'any' ? 'Supermarkt' : P.STORES[st].label)} in der Nähe</a>`).join('')}</div>` : ''}
      <div class="sheet-actions">
        <button class="btn btn-soft" data-action="shop-share">📤 Teilen</button>
        <button class="btn btn-ghost" data-action="shop-clear" ${done ? '' : 'disabled'}>🧹 Erledigte weg</button>
      </div>
    </article>
    <form class="search-inline" data-form="shop-add">
      <input id="shop-new" placeholder="Artikel hinzufügen, z. B. Bananen" autocomplete="off" aria-label="Artikel hinzufügen">
      <button class="btn btn-primary" aria-label="Hinzufügen">＋</button>
    </form>
    ${
      items.length
        ? P.groupShopping(items)
            .map(
              (g) => `<article class="card shop-group">
          <h3>${g.emoji} ${g.label}</h3>
          <ul class="rows">${g.items
            .map(
              (i) => `<li class="shop-item ${i.done ? 'is-done' : ''}">
              <button class="shop-check" data-action="shop-toggle" data-id="${i.id}" aria-pressed="${i.done}" aria-label="${esc(i.name)} abhaken">✓</button>
              <span class="row-main"><b>${esc(i.name)}</b><small>${esc(i.amount || '')}${i.store !== 'any' ? ` · ${P.STORES[i.store].emoji} ${P.STORES[i.store].label}` : ''}</small></span>
              ${i.price ? `<span class="shop-price">${euro(i.price)}</span>` : ''}
              <a class="icon-btn shop-link" href="${P.productSearchUrl(i.name, i.store)}" target="_blank" rel="noopener" aria-label="${esc(i.name)} beim Markt suchen" title="Beim Markt suchen">🔎</a>
              <button class="icon-btn" data-action="shop-del" data-id="${i.id}" aria-label="${esc(i.name)} entfernen">✕</button>
            </li>`,
            )
            .join('')}</ul>
        </article>`,
            )
            .join('')
        : `<section class="empty-hero"><span class="empty-icon" aria-hidden="true">🧾</span><h2>Deine Liste ist leer</h2>
           <p>Lass dir von der KI einen Essensplan erstellen – die passende Einkaufsliste kommt automatisch. Oder tipp oben selbst Artikel ein.</p>
           <button class="btn btn-primary" data-action="plan-sub" data-id="plan">✨ Essensplan erstellen</button></section>`
    }
    <p class="hint center">🔎 sucht das Produkt auf der Seite des Markts, 📍 zeigt den nächsten Markt auf der Karte.</p>`;
}

forms['shop-add'] = () => {
  const name = $('#shop-new').value.trim();
  if (!name) return;
  store.state.shopping.unshift({ id: S.uid(), name, amount: '', section: P.guessSection(name), store: 'any', price: 0, done: false, source: 'manual' });
  haptic(10);
  commit();
  $('#shop-new')?.focus();
};
actions['shop-toggle'] = (d) => {
  const s = store.state;
  const it = s.shopping.find((i) => i.id === d.id);
  if (!it) return;
  it.done = !it.done;
  haptic(it.done ? 15 : 6);
  if (it.done && s.shopping.every((i) => i.done)) {
    confetti({ emojis: ['🛒', '🎉', '🥳'] });
    toast('🛒 Alles eingekauft – super!');
  }
  commit();
};
actions['shop-del'] = (d) => {
  const s = store.state;
  const idx = s.shopping.findIndex((i) => i.id === d.id);
  if (idx < 0) return;
  const [removed] = s.shopping.splice(idx, 1);
  commit();
  toast(`${removed.name} entfernt`, () => {
    store.state.shopping.splice(idx, 0, removed);
    commit();
  });
};
actions['shop-clear'] = async () => {
  if (!(await confirmDialog('Alle abgehakten Artikel von der Liste entfernen?', 'Entfernen'))) return;
  store.state.shopping = store.state.shopping.filter((i) => !i.done);
  commit();
};
actions['shop-share'] = async () => {
  const text = P.shoppingText(store.state.shopping);
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Einkaufsliste', text });
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('📋 Einkaufsliste kopiert – z. B. in WhatsApp einfügen');
  } catch {
    toast('Teilen nicht möglich. Mach einfach einen Screenshot der Liste.');
  }
};

export { save };
