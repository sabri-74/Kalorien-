// KI-Werkzeuge: Speisekarten-Scanner (was bestelle ich?) und
// Kühlschrank-Chef (was koche ich aus dem, was da ist?).

import {
  store, ui, C, S, $, esc, fmt, actions, forms, inputs, openSheet, setSheet, closeSheet, commit, save, toast, haptic,
  targets, dayTotals, profile, addEntry, avatar, nutriGrid,
} from '../core.js';
import { analyzeMenu, fridgeChef, aiStatus, aiErrorText } from '../ai.js';
import { prepareImage, putPhoto } from '../photos.js';
import { confetti } from '../fx.js';

const tool = { kind: 'menu', blob: null, thumb: null, text: '', wish: '', result: null, controller: null };

function budget() {
  const t = targets();
  const { eaten, burned } = dayTotals(ui.date);
  return {
    kcal: Math.max(0, t.kcal + burned - eaten.kcal),
    protein: Math.max(0, t.protein - eaten.protein),
    goal: C.GOALS[profile().goal]?.label || 'ausgewogen essen',
  };
}

const META = {
  menu: {
    emoji: '📋', title: 'Speisekarten-Scanner',
    intro: 'Fotografier die Karte im Restaurant – die KI zeigt dir, was am besten zu deinem Tag passt.',
    field: 'Oder Gerichte abtippen', placeholder: 'z. B. Caesar Salad, Rumpsteak mit Pommes, Lachs mit Gemüse, Pizza Salami',
    button: '✨ Empfehlungen holen', loading: 'Die KI liest die Speisekarte …',
  },
  fridge: {
    emoji: '🧊', title: 'Kühlschrank-Chef',
    intro: 'Zeig der KI, was da ist – sie erfindet ein Rezept, das in dein Budget passt.',
    field: 'Oder Zutaten aufzählen', placeholder: 'z. B. 3 Eier, Spinat, Feta, Tomaten, Vollkornbrot',
    button: '👩‍🍳 Rezept erfinden', loading: 'Die KI stöbert in deinem Kühlschrank …',
  },
};

function introHtml() {
  const m = META[tool.kind];
  const b = budget();
  return `
    <div class="tool-hero tool-${tool.kind}">
      <span class="tool-hero-emoji" aria-hidden="true">${m.emoji}</span>
      <div><h3>${m.title}</h3><p>${m.intro}</p></div>
    </div>
    <div class="chips chips-wrap"><span class="pill pill-info">🎯 noch ${fmt(b.kcal)} kcal</span><span class="pill pill-info">💪 noch ${fmt(b.protein)} g Eiweiß</span></div>
    <div id="tool-provider"></div>
    <div class="grid-2" data-needs-images>
      <button class="big-choice" data-action="tool-photo" data-capture="1"><span aria-hidden="true">📸</span><b>Foto aufnehmen</b></button>
      <button class="big-choice" data-action="tool-photo" data-capture="0"><span aria-hidden="true">🖼️</span><b>Aus der Galerie</b></button>
    </div>
    <form class="stack" data-form="tool-run">
      <label class="field">${m.field}<textarea id="tool-text" rows="3" placeholder="${m.placeholder}">${esc(tool.text)}</textarea></label>
      ${tool.kind === 'fridge' ? `<label class="field">Wunsch (optional)<input id="tool-wish" placeholder="z. B. schnell, vegetarisch, warm" value="${esc(tool.wish)}"></label>` : ''}
      <button class="btn btn-primary btn-block btn-lg">${m.button}</button>
    </form>`;
}

async function checkProvider() {
  const st = await aiStatus(store.state.settings.apiKey);
  const box = $('#tool-provider');
  if (!box) return;
  if (!st.provider) {
    box.innerHTML = `<div class="notice"><b>✨ KI einrichten</b><p>Für dieses Werkzeug braucht die App einen Claude-API-Schlüssel. Du hinterlegst ihn einmal im Profil.</p><button class="btn btn-soft btn-sm" data-action="goto-ai-settings">Jetzt einrichten</button></div>`;
  } else if (!st.images) {
    document.querySelectorAll('[data-needs-images]').forEach((el) => (el.hidden = true));
  }
}

function open(kind) {
  Object.assign(tool, { kind, blob: null, thumb: null, text: '', wish: '', result: null });
  openSheet(META[kind].title, introHtml(), { onClose: () => tool.controller?.abort() });
  checkProvider();
}

actions['menu-scan'] = () => open('menu');
actions['fridge-chef'] = () => open('fridge');

actions['tool-photo'] = (d) => {
  tool.text = $('#tool-text')?.value || '';
  tool.wish = $('#tool-wish')?.value || '';
  const input = $('#tool-photo-input');
  if (d.capture === '1') input.setAttribute('capture', 'environment');
  else input.removeAttribute('capture');
  input.value = '';
  input.click();
};

inputs['tool-photo-input'] = async (el) => {
  const file = el.files?.[0];
  if (!file) return;
  try {
    const { blob, thumb } = await prepareImage(file);
    tool.blob = blob;
    tool.thumb = thumb;
  } catch {
    toast('Das Foto konnte nicht gelesen werden.');
    return;
  }
  run();
};

forms['tool-run'] = () => {
  tool.text = $('#tool-text').value.trim();
  tool.wish = $('#tool-wish')?.value.trim() || '';
  if (!tool.text && !tool.blob) {
    toast(tool.kind === 'menu' ? 'Fotografier die Karte oder tipp ein paar Gerichte ab.' : 'Fotografier den Kühlschrank oder zähl ein paar Zutaten auf.');
    return;
  }
  run();
};

function loadingHtml() {
  return `<div class="ai-loading">
    ${tool.thumb ? `<div class="ai-photo scanning"><img src="${tool.thumb}" alt=""><span class="scan-sweep"></span></div>` : `<div class="ai-orb"><span aria-hidden="true">${META[tool.kind].emoji}</span></div>`}
    <h3>${META[tool.kind].loading}</h3>
    <p class="hint">Das dauert meist 5 bis 20 Sekunden.</p>
    <div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
    <button class="btn btn-ghost" data-action="close-sheet">Abbrechen</button>
  </div>`;
}

async function run() {
  if (!document.querySelector('#sheet').open) openSheet(META[tool.kind].title, '', { onClose: () => tool.controller?.abort() });
  setSheet(META[tool.kind].title, loadingHtml());
  tool.controller = new AbortController();
  const args = { apiKey: store.state.settings.apiKey, image: tool.blob, text: tool.text, budget: budget(), signal: tool.controller.signal };
  try {
    if (tool.kind === 'menu') {
      tool.result = await analyzeMenu(args);
      haptic(20);
      setSheet('🍽️ Meine Empfehlung', menuHtml());
    } else {
      tool.result = await fridgeChef({ ...args, wish: tool.wish });
      haptic(20);
      setSheet('👩‍🍳 Dein Rezept', recipeHtml());
    }
  } catch (e) {
    if (e.code === 'cancelled') return;
    setSheet(META[tool.kind].title, `<div class="ai-loading"><span class="big-emoji" aria-hidden="true">🙈</span><h3>Das hat nicht geklappt</h3><p class="hint">${esc(aiErrorText(e))}</p>
      <div class="sheet-actions"><button class="btn btn-ghost" data-action="tool-back">Zurück</button><button class="btn btn-primary" data-action="tool-retry">Nochmal</button></div></div>`);
  } finally {
    tool.controller = null;
  }
}

actions['tool-retry'] = () => run();
actions['tool-back'] = () => {
  setSheet(META[tool.kind].title, introHtml());
  checkProvider();
};

// ---------- Speisekarte ----------

function menuHtml() {
  const r = tool.result;
  if (!r.picks.length) return `<div class="ai-loading"><span class="big-emoji" aria-hidden="true">🤔</span><p>${esc(r.tip || 'Auf dem Foto war keine Speisekarte zu erkennen.')}</p><button class="btn btn-primary" data-action="tool-back">Nochmal versuchen</button></div>`;
  return `
    ${r.tip ? `<div class="notice"><b>💡 Tipp</b><p>${esc(r.tip)}</p></div>` : ''}
    <div class="picks">${r.picks
      .map(
        (p, i) => `<article class="pick ${p.fits ? 'is-fit' : 'is-nofit'}" style="--i:${i}">
          ${i === 0 ? '<span class="pick-best">🏆 Beste Wahl</span>' : ''}
          <div class="pick-top">
            <span class="pick-emoji" aria-hidden="true">${esc(p.emoji)}</span>
            <div class="grow"><b>${esc(p.name)}</b><p class="sub">${esc(p.why)}</p></div>
          </div>
          <div class="pick-bottom">
            <span class="pick-macros">🔥 <b>${fmt(p.kcal)}</b> kcal · 💪 ${fmt(p.protein)} g</span>
            <span class="pill ${p.fits ? 'pill-good' : 'pill-warn'}">${p.fits ? '✅ passt' : '⚠️ viel'}</span>
            <button class="btn btn-primary btn-sm" data-action="menu-log" data-i="${i}">Eintragen</button>
          </div>
        </article>`,
      )
      .join('')}</div>
    <p class="hint center">Werte sind Schätzungen für eine übliche Restaurantportion.</p>`;
}

actions['menu-log'] = (d) => {
  const p = tool.result.picks[Number(d.i)];
  addEntry(ui.date, C.mealForHour(new Date().getHours()), {
    name: p.name, amount: 1, unit: 'portion', base: { kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat }, source: 'ai',
  });
  closeSheet();
  haptic(24);
  toast(`${p.emoji} ${p.name} eingetragen – guten Appetit!`);
  commit();
};

// ---------- Rezept ----------

function recipeTotals(r) {
  return C.sumNutrients(r.ingredients.map((i) => C.scaleBase(i.base, i.amount, 'g')));
}

function recipeHtml() {
  const r = tool.result;
  const t = recipeTotals(r);
  const perPortion = { kcal: t.kcal / r.servings, protein: t.protein / r.servings, carbs: t.carbs / r.servings, fat: t.fat / r.servings };
  return `
    <div class="recipe-hero">
      ${tool.thumb ? `<img src="${tool.thumb}" alt="">` : ''}
      <span class="recipe-emoji" aria-hidden="true">${esc(r.emoji)}</span>
      <h3>${esc(r.name)}</h3>
      <div class="chips chips-wrap"><span class="pill">⏱️ ${fmt(r.minutes)} Min.</span><span class="pill">🍽️ ${r.servings} ${r.servings === 1 ? 'Portion' : 'Portionen'}</span></div>
    </div>
    ${nutriGrid(perPortion, true)}
    ${r.tip ? `<div class="notice"><b>💡 Profi-Tipp</b><p>${esc(r.tip)}</p></div>` : ''}
    <section><h4 class="eyebrow">🛒 Zutaten</h4><ul class="rows">${r.ingredients
      .map((i) => `<li class="row">${avatar(i.name)}<span class="row-main"><b>${esc(i.name)}</b><small>${fmt(i.amount)} g</small></span><span class="row-end">${fmt(C.scaleBase(i.base, i.amount, 'g').kcal)}<small>kcal</small></span></li>`)
      .join('')}</ul></section>
    ${r.steps.length ? `<section><h4 class="eyebrow">👩‍🍳 Zubereitung</h4><ol class="steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></section>` : ''}
    <div class="sheet-actions sheet-actions-sticky">
      <button class="btn btn-ghost btn-square" data-action="tool-retry" aria-label="Anderes Rezept" title="Anderes Rezept">🔄</button>
      <button class="btn btn-soft" data-action="recipe-save">💾 Speichern</button>
      <button class="btn btn-primary" data-action="recipe-log">✅ Eintragen</button>
    </div>`;
}

async function saveRecipeAsDish() {
  const r = tool.result;
  let photo = null;
  if (tool.thumb) {
    photo = `p-${S.uid()}`;
    await putPhoto(photo, tool.thumb);
  }
  const dish = {
    id: `d-${S.uid()}`,
    name: r.name,
    servings: r.servings,
    photo,
    ingredients: r.ingredients.map((i) => ({ id: S.uid(), name: i.name, amount: i.amount, unit: 'g', base: i.base, ...C.scaleBase(i.base, i.amount, 'g') })),
    steps: r.steps,
    uses: 0,
    createdAt: Date.now(),
  };
  store.state.dishes.unshift(dish);
  return dish;
}

actions['recipe-save'] = async () => {
  const dish = await saveRecipeAsDish();
  save();
  closeSheet();
  confetti({ emojis: ['👩‍🍳', '🍳', '✨'], count: 60 });
  toast(`💾 „${dish.name}“ in deinen Gerichten gespeichert`);
  commit();
};

actions['recipe-log'] = async () => {
  const r = tool.result;
  const t = recipeTotals(r);
  const dish = await saveRecipeAsDish();
  dish.uses = 1;
  dish.lastUsed = Date.now();
  addEntry(ui.date, C.mealForHour(new Date().getHours()), {
    name: r.name, amount: 1, unit: 'portion', dishId: dish.id, photo: dish.photo,
    base: { kcal: t.kcal / r.servings, protein: t.protein / r.servings, carbs: t.carbs / r.servings, fat: t.fat / r.servings }, source: 'ai',
  });
  closeSheet();
  haptic(24);
  toast(`${r.emoji} ${r.name} eingetragen und als Gericht gespeichert`);
  commit();
};
