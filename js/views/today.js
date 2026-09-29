import {
  store, ui, C, S, esc, fmt, icon, views, actions, targets, dayTotals, profile, dateLabel, amountLabel, avatar, macroLine, commit, toast, haptic,
} from '../core.js';

function miniRing(frac, over) {
  const r = 13;
  const c = 2 * Math.PI * r;
  return `<svg viewBox="0 0 32 32" class="mini-ring ${over ? 'over' : ''}" aria-hidden="true">
    <circle cx="16" cy="16" r="${r}" class="track"></circle>
    ${frac > 0 ? `<circle cx="16" cy="16" r="${r}" class="fill" stroke-dasharray="${Math.min(1, frac) * c} ${c}"></circle>` : ''}
  </svg>`;
}

function weekStrip(t) {
  const sel = C.parseKey(ui.date);
  const monday = C.addDays(ui.date, -((sel.getDay() + 6) % 7));
  const today = C.dateKey();
  const days = Array.from({ length: 7 }, (_, i) => C.addDays(monday, i));
  return `
    <nav class="week" aria-label="Woche">
      <button class="week-nav" data-action="week" data-n="-7" aria-label="Vorherige Woche">${icon('chevronLeft')}</button>
      ${days
        .map((k) => {
          const d = C.parseKey(k);
          const { eaten, burned } = dayTotals(k);
          const budget = t.kcal + burned;
          return `<button class="week-day ${k === ui.date ? 'is-selected' : ''} ${k === today ? 'is-today' : ''} ${k > today ? 'is-future' : ''}"
              data-action="pick-day" data-date="${k}" aria-label="${dateLabel(k, true)}" ${k === ui.date ? 'aria-current="date"' : ''}>
            <span class="wd">${d.toLocaleDateString('de-DE', { weekday: 'narrow' })}</span>
            ${miniRing(eaten.kcal / budget, eaten.kcal > budget * 1.05)}
            <span class="dn">${d.getDate()}</span>
          </button>`;
        })
        .join('')}
      <button class="week-nav" data-action="week" data-n="7" aria-label="Nächste Woche">${icon('chevronRight')}</button>
    </nav>`;
}

function hero(t, eaten, burned) {
  const budget = t.kcal + burned;
  const remaining = budget - eaten.kcal;
  const over = remaining < 0;
  const R = 70;
  const CIRC = 2 * Math.PI * R;
  const frac = Math.min(1, eaten.kcal / Math.max(1, budget));
  const macro = (key, label, cls) => {
    const pct = Math.min(100, (eaten[key] / Math.max(1, t[key])) * 100);
    const left = t[key] - eaten[key];
    return `<div class="hm">
      <div class="hm-top"><span>${label}</span><b>${fmt(eaten[key])}<small> / ${fmt(t[key])} g</small></b></div>
      <div class="hm-track"><i class="${cls}" style="width:${pct}%"></i></div>
      <span class="hm-left">${left >= 0 ? `noch ${fmt(left)} g` : `${fmt(-left)} g drüber`}</span>
    </div>`;
  };
  return `
    <section class="hero" aria-label="Kalorienbudget">
      <div class="hero-main">
        <div class="ring-xl ${over ? 'over' : ''}">
          <svg viewBox="0 0 160 160" aria-hidden="true">
            <circle class="track" cx="80" cy="80" r="${R}"></circle>
            ${frac > 0 ? `<circle class="fill" cx="80" cy="80" r="${R}" stroke-dasharray="${frac * CIRC} ${CIRC}"></circle>` : ''}
          </svg>
          <div class="ring-center">
            <b class="ring-num">${fmt(Math.abs(remaining))}</b>
            <span>${over ? 'kcal zu viel' : 'kcal übrig'}</span>
          </div>
        </div>
        <dl class="hero-stats">
          <div><dt>${icon('book')}Gegessen</dt><dd>${fmt(eaten.kcal)}</dd></div>
          <div><dt>${icon('flame')}Training</dt><dd>+${fmt(burned)}</dd></div>
          <div><dt>${icon('target')}Ziel</dt><dd>${fmt(t.kcal)}</dd></div>
        </dl>
      </div>
      <div class="hero-macros">
        ${macro('protein', 'Eiweiß', 'c-protein')}
        ${macro('carbs', 'Kohlenhydrate', 'c-carbs')}
        ${macro('fat', 'Fett', 'c-fat')}
      </div>
    </section>`;
}

function quickActions() {
  return `
    <div class="quick" role="group" aria-label="Schnell eintragen">
      <button class="quick-btn quick-primary" data-action="ai-open" data-mode="photo">${icon('camera')}<span>Foto</span></button>
      <button class="quick-btn" data-action="ai-open" data-mode="text">${icon('sparkle')}<span>Beschreiben</span></button>
      <button class="quick-btn" data-action="open-add">${icon('search')}<span>Suchen</span></button>
      <button class="quick-btn" data-action="goto" data-tab="dishes">${icon('pot')}<span>Gerichte</span></button>
    </div>`;
}

function mealCard(m, day, yesterday) {
  const entries = day.meals[m.id] || [];
  const sum = C.sumNutrients(entries);
  const canCopy = !entries.length && (yesterday.meals[m.id] || []).length > 0;
  return `
    <article class="card meal">
      <header class="meal-head">
        <div>
          <h3>${m.label}</h3>
          <p class="sub">${entries.length ? `${fmt(sum.kcal)} kcal · ${macroLine(sum)}` : 'Noch nichts eingetragen'}</p>
        </div>
        <button class="round-btn" data-action="open-add" data-meal="${m.id}" aria-label="${m.label}: hinzufügen">${icon('plus')}</button>
      </header>
      ${
        entries.length
          ? `<ul class="rows">${entries
              .map(
                (e) => `<li><button class="row" data-action="edit-entry" data-meal="${m.id}" data-id="${e.id}">
                  ${avatar(e.name, e.photo)}
                  <span class="row-main"><b>${esc(e.name)}</b><small>${amountLabel(e)}${e.source === 'ai' ? ' · KI-Schätzung' : ''}</small></span>
                  <span class="row-end">${fmt(e.kcal)}<small>kcal</small></span>
                </button></li>`,
              )
              .join('')}</ul>`
          : ''
      }
      ${
        canCopy || entries.length > 1
          ? `<footer class="meal-foot">
              ${canCopy ? `<button class="link-btn" data-action="copy-meal" data-meal="${m.id}">${icon('copy')}Wie gestern</button>` : ''}
              ${entries.length > 1 ? `<button class="link-btn" data-action="meal-to-dish" data-meal="${m.id}">${icon('save')}Als Gericht speichern</button>` : ''}
            </footer>`
          : ''
      }
    </article>`;
}

function waterCard(day, t) {
  const pct = Math.min(100, (day.water / t.water) * 100);
  return `
    <article class="card water-card">
      <header class="meal-head">
        <div>
          <h3>Wasser</h3>
          <p class="sub">${fmt(day.water / 1000, 2)} von ${fmt(t.water / 1000, 2)} Litern</p>
        </div>
        <span class="water-icon">${icon('drop')}</span>
      </header>
      <div class="water-bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Wasser"><i style="width:${pct}%"></i></div>
      <div class="water-actions">
        <button class="pill-btn" data-action="water-add" data-ml="-250" aria-label="250 ml weniger">${icon('minus')}</button>
        <button class="pill-btn pill-btn-strong" data-action="water-add" data-ml="250">${icon('plus')}250 ml</button>
        <button class="pill-btn pill-btn-strong" data-action="water-add" data-ml="500">${icon('plus')}500 ml</button>
      </div>
    </article>`;
}

function trainingCard(day) {
  const burned = day.workouts.reduce((s, w) => s + w.kcal, 0);
  return `
    <article class="card meal">
      <header class="meal-head">
        <div>
          <h3>Bewegung</h3>
          <p class="sub">${day.workouts.length ? `${fmt(burned)} kcal verbrannt` : 'Noch kein Training'}</p>
        </div>
        <button class="round-btn" data-action="goto" data-tab="training" aria-label="Training eintragen">${icon('plus')}</button>
      </header>
      ${
        day.workouts.length
          ? `<ul class="rows">${day.workouts
              .map(
                (w) => `<li><div class="row">
                  <span class="thumb thumb-icon">${icon(w.type === 'strength' ? 'dumbbell' : 'flame')}</span>
                  <span class="row-main"><b>${esc(w.name)}</b><small>${fmt(w.minutes)} Min.${w.type === 'strength' ? ` · ${w.exercises.length} Übungen` : ''}</small></span>
                  <span class="row-end">${fmt(w.kcal)}<small>kcal</small></span>
                </div></li>`,
              )
              .join('')}</ul>`
          : ''
      }
    </article>`;
}

views.today = (root) => {
  const s = store.state;
  const t = targets();
  const { day, eaten, burned } = dayTotals(ui.date);
  const yesterday = S.peekDay(s, C.addDays(ui.date, -1));
  const p = profile();
  const now = new Date();
  root.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">${esc(dateLabel(ui.date, true))}${ui.date !== C.dateKey() ? ` · <button class="link-inline" data-action="pick-day" data-date="${C.dateKey()}">zu heute</button>` : ''}</p>
        <h1>${esc(C.greeting(now.getHours()))}${p.name && s.profile ? `, ${esc(p.name)}` : ''}</h1>
      </div>
      <button class="avatar-btn" data-action="goto" data-tab="profile" aria-label="Profil und Einstellungen">${icon('user')}</button>
    </header>
    ${weekStrip(t)}
    ${
      s.profile
        ? ''
        : `<div class="notice"><b>${icon('target')}Beispielziele aktiv</b><p>Richte in einer Minute dein Profil ein, dann passen Kalorien- und Nährstoffziele zu dir.</p><button class="btn btn-primary btn-sm" data-action="onboard-open">Profil einrichten</button></div>`
    }
    ${hero(t, eaten, burned)}
    ${quickActions()}
    ${S.MEALS.map((m) => mealCard(m, day, yesterday)).join('')}
    ${waterCard(day, t)}
    ${trainingCard(day)}`;
};

// ---------- Aktionen ----------

actions['pick-day'] = (d) => {
  ui.date = d.date;
  commit();
};
actions.week = (d) => {
  ui.date = C.addDays(ui.date, Number(d.n));
  commit();
};
actions['water-add'] = (d) => {
  const day = S.getDay(store.state, ui.date);
  day.water = Math.max(0, day.water + Number(d.ml));
  haptic();
  commit();
};
actions['copy-meal'] = (d) => {
  const src = S.peekDay(store.state, C.addDays(ui.date, -1)).meals[d.meal] || [];
  S.getDay(store.state, ui.date).meals[d.meal] = src.map((e) => ({ ...e, id: S.uid() }));
  toast('Von gestern übernommen');
  commit();
};
