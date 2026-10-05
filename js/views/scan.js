// KI-Erkennung: Foto oder Beschreibung → Zutaten mit Mengen → prüfen und eintragen.

import {
  store, ui, C, S, $, $$, esc, fmt, num, icon, actions, inputs, forms, openSheet, setSheet, closeSheet, commit, save, toast, haptic,
  nutriGrid, mealOptions, defaultMeal, addEntry,
} from '../core.js';
import { analyzeMeal, aiStatus, aiErrorText } from '../ai.js';
import { prepareImage, putPhoto } from '../photos.js';

const ai = { meal: 'lunch', blob: null, thumb: null, text: '', result: null, controller: null, asDish: false };

const EXAMPLES = [
  '2 Scheiben Vollkornbrot mit Butter und Gouda, ein Cappuccino',
  'Große Portion Spaghetti Bolognese mit Parmesan',
  'Döner mit allem und eine Cola',
  'Schüssel Haferflocken mit Milch, Banane und Honig',
];

function totals() {
  return C.sumNutrients(ai.result.items.map((it) => C.scaleBase(it.base, it.amount, 'g')));
}

// ---------- Einstieg ----------

/** Foto direkt aus der Kamera oder Galerie wählen (muss im Klick passieren). */
function choosePhoto(capture) {
  const input = $('#photo-input');
  if (capture) input.setAttribute('capture', 'environment');
  else input.removeAttribute('capture');
  input.value = '';
  input.click();
}

// Ob diese Ansicht Fotos an die KI schicken kann – vorab ermitteln, weil der
// Dateidialog direkt im Klick geöffnet werden muss.
let photoOk = null;
const refreshPhotoOk = () =>
  aiStatus(store.state.settings.apiKey).then((st) => (photoOk = !st.provider || st.images)).catch(() => {});
refreshPhotoOk();

export function openAi(mode, meal) {
  ai.meal = meal || defaultMeal();
  ai.blob = null;
  ai.thumb = null;
  ai.result = null;
  ai.text = '';
  ai.asDish = false;
  if (mode === 'photo') {
    if (photoOk === false) {
      openSheet('📸 Foto-Erkennung', noPhotoHtml());
      return;
    }
    choosePhoto(true);
    return;
  }
  openSheet('Essen beschreiben', describeHtml());
  checkProvider();
}

function noPhotoHtml() {
  return `<div class="ai-loading">
    <div class="ai-orb">🙈</div>
    <h3>Fotos gehen in dieser Ansicht nicht</h3>
    <p class="hint">Hier kann die KI leider keine Bilder sehen. Beschreib dein Essen in ein paar Worten – das klappt genauso schnell. In der installierten App mit eigenem KI-Schlüssel funktioniert die Foto-Erkennung.</p>
    <div class="sheet-actions">
      <button class="btn btn-soft" data-action="install-help">📲 Foto freischalten</button>
      <button class="btn btn-primary" data-action="ai-describe-instead">✍️ Beschreiben</button>
    </div>
  </div>`;
}

export const APP_URL = 'https://sabri-74.github.io/Kalorien-/';

function installHelpHtml() {
  return `
    <p class="hint">Die Foto-Erkennung läuft in der eigenen App auf deinem Handy. So richtest du sie in 2 Minuten ein:</p>
    <ol class="steps">
      <li><span>Öffne in <b>Safari</b> (iPhone) bzw. <b>Chrome</b> (Android):<br><a href="${APP_URL}" target="_blank" rel="noopener"><b>${APP_URL.replace('https://', '')}</b></a></span></li>
      <li><span>iPhone: Teilen-Knopf <b>⬆️</b> → <b>„Zum Home-Bildschirm“</b>. Android: Menü <b>⋮</b> → <b>„App installieren“</b>.</span></li>
      <li><span>Unter <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> einen KI-Schlüssel anlegen (ein Foto kostet ca. 1–3 Cent).</span></li>
      <li><span>In der App: <b>Profil → KI-Erkennung</b> → Schlüssel einfügen. Fertig – jetzt einfach fotografieren 📸</span></li>
    </ol>
    <p class="hint">💡 Deine bisherigen Einträge nimmst du mit: hier unter Profil → <b>Kopieren</b>, dann in der App beim Start <b>„Ich habe eine kopierte Sicherung“</b> tippen.</p>
    <div class="sheet-actions"><button class="btn btn-primary" data-action="ai-describe-instead">✍️ Jetzt erst mal beschreiben</button></div>`;
}

actions['install-help'] = () => setSheet('📲 Foto-Erkennung freischalten', installHelpHtml());

async function checkProvider() {
  const st = await aiStatus(store.state.settings.apiKey);
  photoOk = !st.provider || st.images;
  const box = $('#ai-provider');
  if (!box) return;
  if (!st.provider) box.innerHTML = setupNotice();
  else if (!st.images) $$('[data-needs-images]').forEach((b) => (b.hidden = true));
}

function setupNotice() {
  return `<div class="notice">
    <b>${icon('sparkle')}KI einrichten</b>
    <p>Für die Erkennung braucht die App einen Claude-API-Schlüssel. Du hinterlegst ihn einmal im Profil; er bleibt nur auf diesem Gerät.</p>
    <button class="btn btn-soft btn-sm" data-action="goto-ai-settings">Jetzt einrichten</button>
  </div>`;
}

function describeHtml() {
  return `
    <div id="ai-provider"></div>
    <form class="stack" data-form="ai-describe">
      <label class="field">Was hast du gegessen?
        <textarea id="ai-text" rows="3" placeholder="${ai.thumb && photoOk === false ? 'Was ist auf dem Foto? z. B. Schokoriegel 50 g' : 'z. B. Teller Nudeln mit Tomatensoße und ein Glas Apfelschorle'}">${esc(ai.text)}</textarea>
      </label>
      <div class="chips chips-wrap">${EXAMPLES.map((e) => `<button type="button" class="chip" data-action="ai-example" data-text="${esc(e)}">${esc(e)}</button>`).join('')}</div>
      <div class="grid-2">
        <label class="field">Mahlzeit<select id="ai-meal">${mealOptions(ai.meal)}</select></label>
        <div class="field"><span>Foto dazu (optional)</span>
          <button type="button" class="btn btn-ghost" data-action="ai-add-photo" data-needs-images>${icon('image')}${ai.thumb ? 'Foto ändern' : 'Foto wählen'}</button>
        </div>
      </div>
      ${ai.thumb ? `<img class="ai-thumb-small" src="${ai.thumb}" alt="Gewähltes Foto">` : ''}
      <button class="btn btn-primary btn-block btn-lg">${icon('sparkle')}Kalorien schätzen</button>
      <p class="hint center">Die KI schätzt Mengen und Nährwerte. Du kannst alles vor dem Eintragen anpassen.</p>
    </form>`;
}

actions['ai-open'] = (d) => openAi(d.mode, d.meal);
actions['fab-camera'] = () => openAi('photo');
actions['ai-example'] = (d) => {
  $('#ai-text').value = d.text;
};
actions['ai-add-photo'] = () => {
  ai.text = $('#ai-text')?.value || '';
  ai.meal = $('#ai-meal')?.value || ai.meal;
  ai.pendingDescribe = true;
  choosePhoto(false);
};

inputs['photo-input'] = async (el) => {
  const file = el.files?.[0];
  if (!file) return;
  try {
    const { blob, thumb } = await prepareImage(file);
    ai.blob = blob;
    ai.thumb = thumb;
  } catch {
    toast('Das Foto konnte nicht gelesen werden. Versuch ein anderes Format (JPEG/PNG).');
    return;
  }
  if (ai.pendingDescribe) {
    ai.pendingDescribe = false;
    openSheet('Essen beschreiben', describeHtml());
    checkProvider();
    return;
  }
  runAnalysis();
};

forms['ai-describe'] = () => {
  ai.text = $('#ai-text').value.trim();
  ai.meal = $('#ai-meal').value;
  if (!ai.text && !ai.blob) {
    toast('Beschreib kurz, was du gegessen hast.');
    return;
  }
  runAnalysis();
};

// ---------- Analyse ----------

function loadingHtml() {
  return `
    <div class="ai-loading">
      ${ai.thumb ? `<div class="ai-photo scanning"><img src="${ai.thumb}" alt=""><span class="scan-sweep"></span></div>` : `<div class="ai-orb">${icon('sparkle')}</div>`}
      <h3>Die KI schaut sich dein Essen an …</h3>
      <p class="hint">Sie erkennt die Zutaten und schätzt Mengen und Nährwerte. Das dauert meist 5 bis 20 Sekunden.</p>
      <button class="btn btn-ghost" data-action="ai-cancel">Abbrechen</button>
    </div>`;
}

async function runAnalysis() {
  ai.controller?.abort();
  openSheet('KI-Erkennung', loadingHtml(), { onClose: () => ai.controller?.abort() });
  const controller = new AbortController();
  ai.controller = controller;
  try {
    ai.result = await analyzeMeal({ apiKey: store.state.settings.apiKey, image: ai.blob, text: ai.text, signal: controller.signal });
    if (controller.signal.aborted) return;
    haptic(20);
    if (!ai.result.items.length) {
      setSheet('KI-Erkennung', errorHtml(ai.result.note || 'Auf dem Foto war kein Essen zu erkennen.'));
      return;
    }
    setSheet('Stimmt das so?', resultHtml());
  } catch (e) {
    if (e.code === 'cancelled' || controller.signal.aborted) return;
    if (e.code === 'images') photoOk = false;
    setSheet('KI-Erkennung', e.code === 'no_provider' ? setupNotice() : errorHtml(aiErrorText(e), e.code !== 'images'));
  } finally {
    if (ai.controller === controller) ai.controller = null;
  }
}

function errorHtml(msg, canRetry = true) {
  return `<div class="ai-loading">
    ${ai.thumb ? `<div class="ai-photo"><img src="${ai.thumb}" alt=""></div>` : ''}
    <h3>Das hat nicht geklappt</h3>
    <p class="hint">${esc(msg)}</p>
    <div class="sheet-actions">
      <button class="btn ${canRetry ? 'btn-ghost' : 'btn-primary'}" data-action="ai-describe-instead">✍️ Beschreiben</button>
      ${canRetry ? '<button class="btn btn-primary" data-action="ai-retry">🔄 Nochmal versuchen</button>' : ''}
    </div>
  </div>`;
}

actions['ai-cancel'] = () => {
  ai.controller?.abort();
  closeSheet();
};
actions['ai-retry'] = () => runAnalysis();
actions['ai-describe-instead'] = () => {
  setSheet('Essen beschreiben', describeHtml());
  checkProvider();
};

// ---------- Ergebnis prüfen ----------

const CONF = { hoch: 'sicher', mittel: 'geschätzt', niedrig: 'unsicher' };

function itemRow(it, i) {
  const n = C.scaleBase(it.base, it.amount, 'g');
  return `<li class="ai-item" data-i="${i}">
    <div class="ai-item-main">
      <input class="ai-name" id="ai-name-${i}" value="${esc(it.name)}" aria-label="Name">
      <span class="conf conf-${it.confidence}">${CONF[it.confidence]}</span>
    </div>
    <div class="ai-item-controls">
      <button class="step-btn step-sm" data-action="ai-step" data-i="${i}" data-dir="-1" aria-label="Weniger">${icon('minus')}</button>
      <label class="step-field step-field-sm"><input id="ai-amount-${i}" data-input="ai-amount" type="number" inputmode="decimal" min="0" value="${it.amount}" aria-label="Gramm ${esc(it.name)}"><span>g</span></label>
      <button class="step-btn step-sm" data-action="ai-step" data-i="${i}" data-dir="1" aria-label="Mehr">${icon('plus')}</button>
      <span class="ai-kcal" id="ai-kcal-${i}">${fmt(n.kcal)} kcal</span>
      <button class="icon-btn" data-action="ai-remove" data-i="${i}" aria-label="${esc(it.name)} entfernen">${icon('close')}</button>
    </div>
  </li>`;
}

function resultHtml() {
  const r = ai.result;
  const t = totals();
  return `
    <div class="ai-result-head">
      ${ai.thumb ? `<div class="ai-photo"><img src="${ai.thumb}" alt="Dein Foto"></div>` : ''}
      <div class="row-main">
        <input class="title-input" id="ai-title" value="${esc(r.title)}" aria-label="Name der Mahlzeit">
        ${r.note ? `<p class="hint">${esc(r.note)}</p>` : ''}
      </div>
    </div>
    <ul class="ai-items">${r.items.map(itemRow).join('')}</ul>
    <div id="ai-total">${nutriGrid(t, true)}</div>
    <details class="refine">
      <summary>${icon('pen')}Etwas stimmt nicht? Der KI Bescheid geben</summary>
      <form class="stack" data-form="ai-refine">
        <textarea id="ai-refine" rows="2" placeholder="z. B. Das ist Vollkornreis und nur eine halbe Portion"></textarea>
        <button class="btn btn-soft">${icon('sparkle')}Neu schätzen</button>
      </form>
    </details>
    <label class="field">Mahlzeit<select id="ai-meal-final">${mealOptions(ai.meal)}</select></label>
    <label class="check-row"><input type="checkbox" id="ai-as-dish" ${ai.asDish ? 'checked' : ''}><span><b>Als Gericht speichern</b><small>Beim nächsten Mal mit einem Tipp eintragen</small></span></label>
    <div class="sheet-actions sheet-actions-sticky">
      <button class="btn btn-primary btn-block btn-lg" data-action="ai-save" id="ai-save">Eintragen · ${fmt(t.kcal)} kcal</button>
    </div>`;
}

function refreshTotals() {
  const t = totals();
  $('#ai-total').innerHTML = nutriGrid(t, true);
  $('#ai-save').textContent = `Eintragen · ${fmt(t.kcal)} kcal`;
  ai.result.items.forEach((it, i) => {
    const el = $(`#ai-kcal-${i}`);
    if (el) el.textContent = `${fmt(C.scaleBase(it.base, it.amount, 'g').kcal)} kcal`;
  });
}

function syncNames() {
  ai.result.items.forEach((it, i) => {
    const el = $(`#ai-name-${i}`);
    if (el) it.name = el.value.trim() || it.name;
  });
  ai.result.title = $('#ai-title')?.value.trim() || ai.result.title;
  ai.asDish = $('#ai-as-dish')?.checked || false;
  ai.meal = $('#ai-meal-final')?.value || ai.meal;
}

inputs['ai-amount'] = (el) => {
  const i = Number(el.id.split('-').pop());
  ai.result.items[i].amount = num(el.value);
  refreshTotals();
};

actions['ai-step'] = (d) => {
  const it = ai.result.items[Number(d.i)];
  const step = it.amount >= 100 ? 25 : 10;
  it.amount = Math.max(0, it.amount + step * Number(d.dir));
  $(`#ai-amount-${d.i}`).value = it.amount;
  refreshTotals();
  haptic(6);
};

actions['ai-remove'] = (d) => {
  syncNames();
  ai.result.items.splice(Number(d.i), 1);
  if (!ai.result.items.length) {
    closeSheet();
    toast('Alle Zutaten entfernt');
    return;
  }
  setSheet(null, resultHtml());
};

forms['ai-refine'] = () => {
  const extra = $('#ai-refine').value.trim();
  if (!extra) return;
  syncNames();
  const list = ai.result.items.map((it) => `${it.name} ${fmt(it.amount)} g`).join(', ');
  ai.text = `${ai.text ? `${ai.text}. ` : ''}Bisherige Schätzung: ${list}. Korrektur: ${extra}`;
  runAnalysis();
};

actions['ai-save'] = async () => {
  syncNames();
  const s = store.state;
  const items = ai.result.items.filter((it) => it.amount > 0);
  if (!items.length) return;
  let photoId = null;
  if (ai.thumb) {
    photoId = `p-${S.uid()}`;
    await putPhoto(photoId, ai.thumb);
  }
  for (const it of items) {
    addEntry(ui.date, ai.meal, { name: it.name, amount: it.amount, unit: 'g', base: it.base, photo: photoId, source: 'ai' });
  }
  if (ai.asDish) {
    s.dishes.unshift({
      id: `d-${S.uid()}`,
      name: ai.result.title,
      servings: 1,
      photo: photoId,
      ingredients: items.map((it) => ({ id: S.uid(), name: it.name, amount: it.amount, base: it.base, ...C.scaleBase(it.base, it.amount, 'g') })),
      uses: 1,
      createdAt: Date.now(),
      lastUsed: Date.now(),
    });
  }
  closeSheet();
  haptic(24);
  const kcal = C.sumNutrients(items.map((it) => C.scaleBase(it.base, it.amount, 'g'))).kcal;
  toast(`${ai.result.title}: ${fmt(kcal)} kcal eingetragen${ai.asDish ? ' und als Gericht gespeichert' : ''}`);
  commit();
};

actions['goto-ai-settings'] = () => {
  closeSheet();
  ui.tab = 'profile';
  commit();
  setTimeout(() => $('#ai-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
};

export { save };
