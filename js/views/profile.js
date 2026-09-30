import {
  store, ui, C, S, $, $$, esc, fmt, num, icon, views, actions, forms, inputs, commit, save, toast, confirmDialog, targets, profile, currentWeight,
  setWeight, DEFAULT_PROFILE, addEntry, haptic,
} from '../core.js';
import { FOODS } from '../foods.js';
import { STRENGTH_MET } from '../exercises.js';
import { aiStatus, AI_MODEL } from '../ai.js';
import { confetti } from '../fx.js';

const opt = (obj, val) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${esc(v.label)}</option>`).join('');

// ---------- Profil-Seite ----------

views.profile = (root) => {
  const s = store.state;
  const p = profile();
  const t = targets();
  const w = currentWeight();
  root.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">${s.profile ? esc(C.GOALS[p.goal]?.label || '') : 'Beispielprofil'}</p><h1>${esc(p.name && s.profile ? p.name : 'Profil')}</h1></div>
      <button class="btn btn-ghost" data-action="onboard-open">${icon('target')}Ziele neu einrichten</button>
    </header>

    <article class="card" id="profile-results">${resultsHtml()}</article>

    <article class="card">
      <h3>🧍 Deine Angaben</h3>
      <form class="stack" data-form="profile">
        <label class="field">Name<input id="p-name" value="${esc(p.name)}" autocomplete="given-name" placeholder="optional"></label>
        <div class="grid-2">
          <label class="field">Geschlecht<select id="p-sex"><option value="female" ${p.sex === 'female' ? 'selected' : ''}>Weiblich</option><option value="male" ${p.sex === 'male' ? 'selected' : ''}>Männlich</option></select></label>
          <label class="field">Alter<input id="p-age" type="number" inputmode="numeric" min="14" max="100" value="${p.age}" required></label>
          <label class="field">Größe (cm)<input id="p-height" type="number" inputmode="numeric" min="120" max="230" value="${p.height}" required></label>
          <label class="field">Gewicht (kg)<input id="p-weight" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${w}" required></label>
        </div>
        <label class="field">Alltag & Sport<select id="p-activity">${opt(C.ACTIVITY_LEVELS, p.activity)}</select></label>
        <div class="grid-2">
          <label class="field">Ziel<select id="p-goal">${opt(C.GOALS, p.goal)}</select></label>
          <label class="field">Zielgewicht (kg)<input id="p-target" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${p.targetWeight || ''}"></label>
        </div>
        <label class="field">Eigenes Kalorienziel (optional)<input id="custom-kcal" type="number" inputmode="numeric" min="800" max="6000" placeholder="automatisch: ${fmt(C.calorieTarget({ ...p, weight: w }))} kcal" value="${s.settings.customKcal || ''}"></label>
        <button class="btn btn-primary btn-block">Speichern</button>
      </form>
    </article>

    <article class="card" id="ai-settings">
      <h3>✨ KI-Erkennung</h3>
      <p class="hint" id="ai-state">Prüfe Verbindung …</p>
      <form class="stack" data-form="api-key">
        <label class="field">Claude-API-Schlüssel
          <input id="api-key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…" value="${esc(s.settings.apiKey)}">
        </label>
        <p class="hint">Einen Schlüssel bekommst du unter <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>. Er wird nur auf diesem Gerät gespeichert und direkt an Anthropic gesendet. Eine Foto-Analyse kostet dort etwa 1 bis 3 Cent.</p>
        <div class="row-end">
          ${s.settings.apiKey ? '<button type="button" class="btn btn-ghost" data-action="api-key-clear">Entfernen</button>' : ''}
          <button class="btn btn-primary">Schlüssel speichern</button>
        </div>
      </form>
    </article>

    <article class="card">
      <h3>🎨 Darstellung</h3>
      <div class="seg" role="group" aria-label="Farbschema">
        ${[['system', '🌗 Auto'], ['light', '☀️ Hell'], ['dark', '🌙 Dunkel']].map(([id, l]) => `<button data-action="theme" data-id="${id}" aria-pressed="${s.settings.theme === id}">${l}</button>`).join('')}
      </div>
    </article>

    <article class="card">
      <h3>💾 Deine Daten</h3>
      <p class="hint">Alles bleibt auf diesem Gerät. Sichere deine Daten ab und zu, z. B. vor einem Handywechsel. Fotos sind in der Sicherung nicht enthalten.</p>
      <div class="btn-grid">
        <button class="btn btn-soft" data-action="export">${icon('save')}Sicherung speichern</button>
        <button class="btn btn-soft" data-action="copy-export">${icon('copy')}Kopieren</button>
        <label class="btn btn-ghost">${icon('undo')}Sicherung laden<input type="file" id="import-file" accept="application/json,.json" hidden></label>
        <button class="btn btn-ghost" data-action="demo">${icon('sparkle')}Beispieldaten</button>
      </div>
      <button class="link-btn danger" data-action="reset">${icon('trash')}Alle Daten löschen</button>
    </article>

    <p class="footnote">Berechnung nach Mifflin-St Jeor und MET-Werten. Alle Werte – auch die der KI – sind Schätzungen und ersetzen keine ärztliche oder ernährungsfachliche Beratung.</p>`;
  showAiState();
};

function resultsHtml() {
  const t = targets();
  const p = { ...profile(), weight: currentWeight() };
  const goal = C.GOALS[p.goal];
  return `
    <h3>🔥 Dein Tagesbedarf</h3>
    <div class="budget-eq">
      <div><span>Grundumsatz</span><b>${fmt(t.bmr)}</b></div>
      <div><span>+ Alltag</span><b>${fmt(t.tdee - t.bmr)}</b></div>
      <div><span>${goal.delta < 0 ? '− Defizit' : goal.delta > 0 ? '+ Überschuss' : '± Halten'}</span><b>${fmt(Math.abs(store.state.settings.customKcal ? t.kcal - t.tdee : goal.delta))}</b></div>
      <div class="eq-total"><span>= Tagesziel</span><b>${fmt(t.kcal)} <small>kcal</small></b></div>
    </div>
    <div class="nutri">
      <div><b>${fmt(t.protein)}</b><span>Eiweiß g</span></div>
      <div><b>${fmt(t.carbs)}</b><span>Kohlenh. g</span></div>
      <div><b>${fmt(t.fat)}</b><span>Fett g</span></div>
      <div><b>${fmt(t.water / 1000, 1)}</b><span>Wasser l</span></div>
    </div>`;
}

async function showAiState() {
  const st = await aiStatus(store.state.settings.apiKey);
  const el = $('#ai-state');
  if (!el) return;
  el.innerHTML =
    st.provider === 'claude'
      ? `<span class="pill pill-good">${icon('check')}Aktiv</span> Hier läuft die KI über dein Claude-Konto – kein Schlüssel nötig.`
      : st.provider === 'api'
        ? `<span class="pill pill-good">${icon('check')}Aktiv</span> Mit deinem API-Schlüssel (Modell ${AI_MODEL}).`
        : '<span class="pill pill-warn">Nicht eingerichtet</span> Hinterleg einen API-Schlüssel, um Mahlzeiten per Foto oder Beschreibung zu erfassen.';
}

forms.profile = () => {
  const v = (id) => $(`#${id}`).value;
  const weight = num(v('p-weight'));
  const s = store.state;
  s.profile = {
    name: v('p-name').trim(),
    sex: v('p-sex'),
    age: num(v('p-age')),
    height: num(v('p-height')),
    weight,
    activity: v('p-activity'),
    goal: v('p-goal'),
    targetWeight: num(v('p-target')) || null,
  };
  const ck = num(v('custom-kcal'));
  s.settings.customKcal = ck >= 800 ? ck : null;
  if (weight && weight !== currentWeight()) setWeight(C.dateKey(), weight);
  haptic(18);
  toast('Gespeichert – Ziele neu berechnet');
  commit();
};

forms['api-key'] = () => {
  const key = $('#api-key').value.trim();
  if (key && !key.startsWith('sk-ant-')) {
    toast('Das sieht nicht nach einem Claude-Schlüssel aus (beginnt mit „sk-ant-“).');
    return;
  }
  store.state.settings.apiKey = key;
  toast(key ? 'Schlüssel gespeichert – die KI ist bereit' : 'Schlüssel entfernt');
  commit();
};
actions['api-key-clear'] = () => {
  store.state.settings.apiKey = '';
  toast('Schlüssel entfernt');
  commit();
};

actions.theme = (d) => {
  store.state.settings.theme = d.id;
  commit();
};

// ---------- Export / Import ----------

function exportJson() {
  return JSON.stringify({ app: 'kalorien', exportedAt: new Date().toISOString(), ...store.state, settings: { ...store.state.settings, apiKey: '' } }, null, 2);
}

actions.export = () => {
  const blob = new Blob([exportJson()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kalorien-sicherung-${C.dateKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

actions['copy-export'] = async () => {
  try {
    await navigator.clipboard.writeText(exportJson());
    toast('Sicherung in die Zwischenablage kopiert');
  } catch {
    toast('Kopieren nicht möglich. Nutz „Sicherung speichern“.');
  }
};

inputs['import-file'] = async (el) => {
  const file = el.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object' || !data.days) throw new Error('format');
    const key = store.state.settings.apiKey;
    store.state = S.migrate(data);
    store.state.settings.apiKey = store.state.settings.apiKey || key;
    toast('Sicherung geladen');
    commit();
  } catch {
    toast('Die Datei ist keine gültige Sicherung dieser App.');
  }
  el.value = '';
};

actions.reset = async () => {
  if (await confirmDialog('Wirklich alle Daten auf diesem Gerät löschen? Das lässt sich nicht rückgängig machen.', 'Alles löschen')) {
    store.state = S.defaultState();
    ui.tab = 'today';
    commit();
    openOnboarding();
  }
};

// ---------- Beispieldaten ----------

export function loadDemo() {
  const s = store.state;
  const f = (n) => FOODS.find((x) => x.name === n);
  const add = (key, meal, name, g) => {
    const food = f(name);
    addEntry(key, meal, { name: food.name, amount: g, unit: 'g', base: { kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat }, foodId: food.id });
  };
  const menus = [
    { breakfast: [['Haferflocken', 60], ['Milch 1,5 %', 200], ['Banane', 120]], lunch: [['Hähnchenbrust', 150], ['Reis (gekocht)', 180], ['Brokkoli', 150]], dinner: [['Vollkornbrot', 100], ['Gouda', 30], ['Tomate', 100]], snacks: [['Skyr natur', 150], ['Apfel', 180]] },
    { breakfast: [['Skyr natur', 200], ['Heidelbeeren', 125], ['Granola', 40]], lunch: [['Nudeln (gekocht)', 250], ['Tomatensauce', 150], ['Parmesan', 10]], dinner: [['Lachs', 125], ['Kartoffeln (gekocht)', 200], ['Grüne Bohnen', 150]], snacks: [['Mandeln', 30]] },
    { breakfast: [['Vollkornbrötchen', 60], ['Frischkäse', 30], ['Ei (Größe M)', 120]], lunch: [['Linsen (gekocht)', 200], ['Karotte', 80], ['Olivenöl', 10]], dinner: [['Putenbrust', 150], ['Süßkartoffel (gekocht)', 200], ['Spinat', 100]], snacks: [['Proteinriegel', 60], ['Cappuccino', 200]] },
  ];
  const today = C.dateKey();
  if (!s.profile) s.profile = { ...DEFAULT_PROFILE, name: 'Alex', weight: 72.4 };
  const startKg = currentWeight() + 1.6;
  for (let i = 13; i >= 1; i--) {
    const key = C.addDays(today, -i);
    s.days[key] = S.emptyDay();
    const menu = menus[i % menus.length];
    for (const [meal, items] of Object.entries(menu)) for (const [n, g] of items) add(key, meal, n, g);
    if (i % 4 === 1) add(key, 'snacks', 'Vollmilchschokolade', 50);
    s.days[key].water = 1500 + (i % 3) * 500;
    if (i % 2 === 0) {
      s.days[key].workouts.push({
        id: S.uid(), type: 'strength', name: i % 4 === 0 ? 'Ganzkörper 3×/Woche · Tag A' : 'Ganzkörper 3×/Woche · Tag B', minutes: 50,
        kcal: C.metCalories(STRENGTH_MET, 72, 50),
        exercises: [
          { id: 'squat', name: 'Kniebeuge', sets: [0, 1, 2].map(() => ({ reps: 10, weight: 50 + (13 - i) * 1.25 })) },
          { id: 'bench', name: 'Bankdrücken', sets: [0, 1, 2].map(() => ({ reps: 8, weight: 35 + (13 - i) })) },
          { id: 'row', name: 'Langhantelrudern', sets: [0, 1, 2].map(() => ({ reps: 10, weight: 40 })) },
        ],
      });
    } else if (i % 3 === 0) {
      s.days[key].workouts.push({ id: S.uid(), type: 'cardio', name: 'Joggen (8 km/h)', minutes: 30, kcal: C.metCalories(8.3, 72, 30) });
    }
    if (i % 2 === 1) setWeight(key, Math.round((startKg - (13 - i) * 0.12 + ((i * 7) % 5) * 0.1) * 10) / 10);
  }
  // Heute: Frühstück schon eingetragen
  const todayDay = S.getDay(s, today);
  if (!todayDay.meals.breakfast.length) for (const [n, g] of menus[0].breakfast) add(today, 'breakfast', n, g);
  if (!todayDay.water) todayDay.water = 750;
  if (!s.dishes.length) {
    const ing = (n, g) => {
      const food = f(n);
      const base = { kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat };
      return { id: S.uid(), name: food.name, amount: g, unit: 'g', base, ...C.scaleBase(base, g, 'g') };
    };
    s.dishes.push(
      { id: `d-${S.uid()}`, name: 'Mein Porridge', servings: 1, uses: 6, createdAt: Date.now() - 5e8, lastUsed: Date.now() - 864e5, ingredients: [ing('Haferflocken', 60), ing('Milch 1,5 %', 200), ing('Banane', 120)] },
      { id: `d-${S.uid()}`, name: 'Hähnchen-Reis-Bowl', servings: 1, uses: 4, createdAt: Date.now() - 4e8, lastUsed: Date.now() - 1728e5, ingredients: [ing('Hähnchenbrust', 150), ing('Reis (gekocht)', 180), ing('Brokkoli', 150), ing('Olivenöl', 10)] },
      { id: `d-${S.uid()}`, name: 'Linsen-Dal', servings: 4, uses: 2, createdAt: Date.now() - 3e8, ingredients: [ing('Linsen (gekocht)', 600), ing('Tomatensauce', 400), ing('Zwiebel', 120), ing('Rapsöl', 20), ing('Reis (gekocht)', 500)] },
    );
  }
  toast('Beispieldaten für 2 Wochen geladen');
  commit();
}
actions.demo = loadDemo;

// ---------- Einrichtungs-Assistent ----------

const ob = { step: 0, data: null };
const STEPS = 5;

export function openOnboarding() {
  const p = store.state.profile || DEFAULT_PROFILE;
  ob.step = 0;
  ob.data = { ...p, weight: store.state.profile ? currentWeight() : p.weight };
  renderOnboarding();
  const dlg = $('#onboard');
  if (!dlg.open) dlg.showModal();
}

function choiceCards(name, entries, selected) {
  return `<div class="choices" role="radiogroup">${entries
    .map(([id, title, sub]) => `<button class="choice" role="radio" aria-checked="${id === selected}" data-action="ob-choose" data-name="${name}" data-id="${id}"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`)
    .join('')}</div>`;
}

function renderOnboarding() {
  const d = ob.data;
  const dots = Array.from({ length: STEPS }, (_, i) => `<i class="${i <= ob.step ? 'on' : ''}"></i>`).join('');
  let body = '';
  let next = 'Weiter';
  if (ob.step === 0) {
    body = `
      <div class="ob-hero">
        <span class="ob-logo" aria-hidden="true"></span>
        <h1>Kalorien zählen, ohne Zählerei <span aria-hidden="true">🥑</span></h1>
        <p>Fotografier dein Essen, die KI erkennt Zutaten und Kalorien. Deine Lieblingsgerichte trägst du mit einem Tipp ein.</p>
        <ul class="ob-points">
          <li style="--i:0"><i aria-hidden="true">📸</i><span><b>Foto-KI</b> erkennt Teller, Snacks und Restaurantessen</span></li>
          <li style="--i:1"><i aria-hidden="true">📋</i><span><b>Speisekarten-Scanner</b> & <b>Kühlschrank-Chef</b></span></li>
          <li style="--i:2"><i aria-hidden="true">🍲</i><span><b>Eigene Gerichte</b> mit einem Tipp wieder eintragen</span></li>
          <li style="--i:3"><i aria-hidden="true">🏅</i><span><b>Abzeichen, Tages-Score & Avo</b>, dein Buddy</span></li>
        </ul>
      </div>`;
    next = 'Los geht’s 🚀';
  } else if (ob.step === 1) {
    body = `<h2>🎯 Was ist dein Ziel?</h2>${choiceCards('goal', [
      ['lose_fast', '⚡ Schnell abnehmen', 'ca. 0,75 kg pro Woche'],
      ['lose', '📉 Abnehmen', 'ca. 0,5 kg pro Woche'],
      ['maintain', '⚖️ Gewicht halten', 'fit und ausgewogen essen'],
      ['gain', '💪 Muskeln aufbauen', 'leichter Überschuss, viel Eiweiß'],
    ], d.goal)}`;
  } else if (ob.step === 2) {
    body = `<h2>🧍 Ein paar Angaben zu dir</h2>
      <form class="stack" data-form="ob-body" id="ob-body">
        <label class="field">Wie heißt du?<input id="ob-name" value="${esc(d.name)}" placeholder="Vorname (optional)" autocomplete="given-name"></label>
        <div class="seg seg-block" role="radiogroup" aria-label="Geschlecht">
          <button type="button" role="radio" data-action="ob-choose" data-name="sex" data-id="female" aria-pressed="${d.sex === 'female'}">👩 Weiblich</button>
          <button type="button" role="radio" data-action="ob-choose" data-name="sex" data-id="male" aria-pressed="${d.sex === 'male'}">👨 Männlich</button>
        </div>
        <div class="grid-3">
          <label class="field">Alter<input id="ob-age" type="number" inputmode="numeric" min="14" max="100" value="${d.age}"></label>
          <label class="field">Größe cm<input id="ob-height" type="number" inputmode="numeric" min="120" max="230" value="${d.height}"></label>
          <label class="field">Gewicht kg<input id="ob-weight" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${d.weight}"></label>
        </div>
        ${d.goal !== 'maintain' ? `<label class="field">Zielgewicht kg<input id="ob-target" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${d.targetWeight || ''}" placeholder="optional"></label>` : ''}
      </form>`;
  } else if (ob.step === 3) {
    body = `<h2>🏃 Wie aktiv bist du im Alltag?</h2>${choiceCards('activity', Object.entries(C.ACTIVITY_LEVELS).map(([id, v]) => {
      const [title, sub] = v.label.split(' (');
      const e = { sedentary: '🛋️', light: '🚶', moderate: '🚴', active: '🏃', athlete: '🏋️' }[id];
      return [id, `${e} ${title}`, sub ? sub.replace(')', '') : ''];
    }), d.activity)}`;
  } else {
    const kcal = C.calorieTarget(d);
    const m = C.macroTargets(kcal, d.weight, d.goal);
    body = `
      <div class="ob-result">
        <span class="ob-party" aria-hidden="true">🎉</span>
        <p class="eyebrow">Dein Tagesziel</p>
        <b class="ob-kcal">${fmt(kcal)}</b><span>kcal pro Tag</span>
        <div class="nutri">
          <div><b>${fmt(m.protein)}</b><span>Eiweiß g</span></div>
          <div><b>${fmt(m.carbs)}</b><span>Kohlenh. g</span></div>
          <div><b>${fmt(m.fat)}</b><span>Fett g</span></div>
          <div><b>${fmt(C.waterTarget(d.weight) / 1000, 1)}</b><span>Wasser l</span></div>
        </div>
        <p class="hint">Grundumsatz ${fmt(C.bmr(d))} kcal, mit Alltag ${fmt(C.tdee(d))} kcal. Du kannst alles später im Profil ändern.</p>
      </div>`;
    next = 'Fertig – los geht’s! 🎉';
  }
  $('#onboard-body').innerHTML = `
    <div class="ob-top">
      ${ob.step > 0 ? `<button class="icon-btn" data-action="ob-back" aria-label="Zurück">${icon('chevronLeft')}</button>` : '<span></span>'}
      <div class="ob-dots" aria-label="Schritt ${ob.step + 1} von ${STEPS}">${dots}</div>
      ${store.state.profile ? `<button class="icon-btn" data-action="ob-close" aria-label="Schließen">${icon('close')}</button>` : '<span></span>'}
    </div>
    <div class="ob-content">${body}</div>
    <div class="ob-foot">
      <button class="btn btn-primary btn-block btn-lg" data-action="ob-next">${next}</button>
      ${ob.step === 0 && !store.state.profile ? '<button class="btn btn-ghost btn-block" data-action="ob-demo">Erst mal umschauen (mit Beispieldaten)</button>' : ''}
    </div>`;
}

function syncBody() {
  if (ob.step !== 2) return;
  const d = ob.data;
  d.name = $('#ob-name').value.trim();
  d.age = num($('#ob-age').value) || d.age;
  d.height = num($('#ob-height').value) || d.height;
  d.weight = num($('#ob-weight').value) || d.weight;
  const tw = $('#ob-target');
  if (tw) d.targetWeight = num(tw.value) || null;
}

actions['ob-choose'] = (d) => {
  syncBody();
  ob.data[d.name] = d.id;
  if (d.name === 'sex') {
    $$('[data-name="sex"]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.id === d.id));
    return;
  }
  renderOnboarding();
  haptic(8);
  setTimeout(() => {
    ob.step++;
    renderOnboarding();
  }, 180);
};
actions['ob-next'] = () => {
  syncBody();
  if (ob.step === 2) {
    const d = ob.data;
    if (d.age < 14 || d.height < 120 || d.weight < 30) {
      toast('Bitte prüf Alter, Größe und Gewicht.');
      return;
    }
  }
  if (ob.step < STEPS - 1) {
    ob.step++;
    renderOnboarding();
    return;
  }
  const s = store.state;
  const first = !s.profile;
  s.profile = { ...ob.data };
  if (first || ob.data.weight !== currentWeight()) setWeight(C.dateKey(), ob.data.weight);
  s.settings.customKcal = null;
  $('#onboard').close();
  ui.tab = 'today';
  confetti();
  toast(first ? '🎉 Alles bereit! Trag deine erste Mahlzeit ein.' : '🎯 Ziele aktualisiert');
  commit();
};
forms['ob-body'] = () => actions['ob-next']();
actions['ob-back'] = () => {
  syncBody();
  ob.step = Math.max(0, ob.step - 1);
  renderOnboarding();
};
actions['ob-close'] = () => $('#onboard').close();
actions['ob-demo'] = () => {
  $('#onboard').close();
  loadDemo();
};
actions['onboard-open'] = openOnboarding;

export { save };
