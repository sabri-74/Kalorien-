// Eingabe der Vorlieben: „Esse ich gern“ und „Esse ich nicht“.
// Die Karte aktualisiert sich selbst, damit andere Eingaben auf der Seite erhalten bleiben.

import { store, $, esc, actions, forms, save, toast, haptic } from '../core.js';
import { splitInput, findMatches } from '../prefs.js';

const SUGGEST = {
  likes: ['Hähnchen', 'Reis', 'Nudeln', 'Kartoffeln', 'Eier', 'Quark', 'Lachs', 'Curry', 'Salat', 'Haferflocken'],
  dislikes: ['Pilze', 'Fisch', 'Schwein', 'Nüsse', 'Laktose', 'Gluten', 'Zwiebeln', 'Koriander', 'Scharfes', 'Eier'],
};

const META = {
  likes: { emoji: '😋', title: 'Esse ich gern', placeholder: 'z. B. Hähnchen, Reis, Curry', cls: 'pref-like' },
  dislikes: { emoji: '🚫', title: 'Esse ich nicht / vertrage ich nicht', placeholder: 'z. B. Pilze, Fisch, Laktose', cls: 'pref-dislike' },
};

export function prefs() {
  const s = store.state;
  if (!s.prefs) s.prefs = { likes: [], dislikes: [] };
  return s.prefs;
}

/** Ist ein Lebensmittel laut Vorlieben unerwünscht bzw. beliebt? */
export function prefFlags(name) {
  const p = prefs();
  return { disliked: findMatches([name], p.dislikes).length > 0, liked: findMatches([name], p.likes).length > 0 };
}

function block(k) {
  const m = META[k];
  const list = prefs()[k];
  const rest = SUGGEST[k].filter((x) => !list.some((y) => y.toLowerCase() === x.toLowerCase()));
  return `<div class="pref-block ${m.cls}">
    <b class="pref-title">${m.emoji} ${m.title}</b>
    <div class="tags">${
      list.length
        ? list.map((t) => `<button type="button" class="tag" data-action="pref-del" data-k="${k}" data-v="${esc(t)}" aria-label="${esc(t)} entfernen">${esc(t)}<i aria-hidden="true">✕</i></button>`).join('')
        : '<span class="hint">Noch nichts eingetragen.</span>'
    }</div>
    <form class="search-inline" data-form="pref-add" data-k="${k}">
      <input id="pref-${k}" placeholder="${m.placeholder}" autocomplete="off" aria-label="${m.title}: Begriff eintippen">
      <button class="btn btn-primary" aria-label="Hinzufügen">＋</button>
    </form>
    ${rest.length ? `<div class="chips chips-wrap pref-suggest">${rest.slice(0, 8).map((x) => `<button type="button" class="chip" data-action="pref-quick" data-k="${k}" data-v="${esc(x)}">+ ${esc(x)}</button>`).join('')}</div>` : ''}
  </div>`;
}

export function prefsCardHtml() {
  return `<article class="card prefs-card" id="prefs-card">
    <header class="meal-head">
      <span class="meal-emoji" aria-hidden="true">🍽️</span>
      <div class="grow"><h3>Deine Vorlieben</h3><p class="sub">Essenspläne, Rezepte und Vorschläge richten sich danach.</p></div>
    </header>
    ${block('likes')}
    ${block('dislikes')}
  </article>`;
}

/** Kurze Zusammenfassung, z. B. für die KI-Werkzeuge. */
export function prefsSummaryHtml() {
  const p = prefs();
  if (!p.likes.length && !p.dislikes.length) return '<p class="hint">💡 Tipp: Unter Profil → Vorlieben kannst du eintragen, was du gern bzw. nicht isst.</p>';
  return `<p class="hint pref-summary">${p.likes.length ? `😋 ${esc(p.likes.join(', '))}` : ''}${p.likes.length && p.dislikes.length ? ' · ' : ''}${p.dislikes.length ? `🚫 ohne ${esc(p.dislikes.join(', '))}` : ''}</p>`;
}

function refresh(focusKey) {
  const card = $('#prefs-card');
  if (card) card.outerHTML = prefsCardHtml();
  if (focusKey) $(`#pref-${focusKey}`)?.focus();
}

function add(k, terms) {
  const p = prefs();
  const other = k === 'likes' ? 'dislikes' : 'likes';
  let added = 0;
  for (const t of terms) {
    if (p[k].some((x) => x.toLowerCase() === t.toLowerCase())) continue;
    p[other] = p[other].filter((x) => x.toLowerCase() !== t.toLowerCase());
    p[k].push(t);
    added++;
  }
  if (!added) return;
  save();
  haptic(10);
  toast(k === 'likes' ? `😋 Gemerkt: ${terms.join(', ')}` : `🚫 Wird ab jetzt vermieden: ${terms.join(', ')}`);
}

forms['pref-add'] = (form) => {
  const k = form.dataset.k;
  const input = form.querySelector('input');
  const terms = splitInput(input.value);
  if (!terms.length) return;
  add(k, terms);
  refresh(k);
};

actions['pref-quick'] = (d) => {
  add(d.k, [d.v]);
  refresh();
};

actions['pref-del'] = (d) => {
  const p = prefs();
  p[d.k] = p[d.k].filter((x) => x !== d.v);
  save();
  refresh();
};
