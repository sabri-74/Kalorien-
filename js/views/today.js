import {
  store, ui, C, S, $, esc, fmt, icon, views, actions, targets, dayTotals, profile, dateLabel, amountLabel, avatar, macroLine,
  commit, save, toast, haptic, openSheet, currentWeight, dishTotalsCached,
} from '../core.js';
import { FOODS } from '../foods.js';
import { MEAL_META, CARDIO_EMOJI, MOODS } from '../emoji.js';
import * as I from '../insights.js';
import { countUp, ringFrom, playRings, confetti } from '../fx.js';
import { pickFood, pickDish } from './food.js';
import { prefFlags } from './prefs.js';

// Empfohlene Verteilung der Tageskalorien auf die Mahlzeiten
const MEAL_SHARE = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snacks: 0.1 };
const GOAL_CHIP = { lose_fast: '⚡ Schnell abnehmen', lose: '📉 Abnehmen', maintain: '⚖️ Halten', gain: '💪 Aufbauen' };
let tipIndex = 0;

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
          const done = eaten.kcal > 0 && eaten.kcal <= budget * 1.05 && eaten.kcal >= budget * 0.8;
          return `<button class="week-day ${k === ui.date ? 'is-selected' : ''} ${k === today ? 'is-today' : ''} ${k > today ? 'is-future' : ''}"
              data-action="pick-day" data-date="${k}" aria-label="${dateLabel(k, true)}" ${k === ui.date ? 'aria-current="date"' : ''}>
            <span class="wd">${d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')}</span>
            <span class="wr">${miniRing(eaten.kcal / budget, eaten.kcal > budget * 1.05)}${done ? '<span class="wd-star" aria-label="im Ziel">⭐</span>' : ''}</span>
            <span class="dn">${d.getDate()}</span>
          </button>`;
        })
        .join('')}
      <button class="week-nav" data-action="week" data-n="7" aria-label="Nächste Woche">${icon('chevronRight')}</button>
    </nav>`;
}

function hero(t, eaten, burned, score) {
  const budget = t.kcal + burned;
  const remaining = budget - eaten.kcal;
  const over = remaining < 0;
  const R = 68;
  const CIRC = 2 * Math.PI * R;
  const frac = Math.min(1, eaten.kcal / Math.max(1, budget));
  const from = ringFrom(`day:${ui.date}`, frac);
  const macro = (key, emoji, label, cls) => {
    const pct = Math.min(100, (eaten[key] / Math.max(1, t[key])) * 100);
    const left = t[key] - eaten[key];
    return `<div class="hm">
      <div class="hm-top"><span><i aria-hidden="true">${emoji}</i>${label}</span><b>${fmt(eaten[key])}<small> / ${fmt(t[key])} g</small></b></div>
      <div class="hm-track"><i class="${cls}" style="width:${pct}%"></i></div>
      <span class="hm-left">${left >= 0 ? `noch ${fmt(left)} g` : `${fmt(-left)} g drüber`}</span>
    </div>`;
  };
  return `
    <section class="hero ${over ? 'hero-over' : ''}" aria-label="Kalorienbudget">
      <span class="hero-blob hb1" aria-hidden="true"></span><span class="hero-blob hb2" aria-hidden="true"></span>
      <div class="hero-top">
        <span class="hero-chip">${GOAL_CHIP[profile().goal] || '🎯 Ziel'}</span>
        <button class="score-chip" data-action="score-info" aria-label="Tages-Score ${score.total} von 100: ${score.grade}">
          <span class="score-emoji" aria-hidden="true">${score.emoji}</span><b>${score.total}</b><small>Punkte</small>
        </button>
      </div>
      <div class="hero-main">
        <div class="ring-xl">
          <svg viewBox="0 0 160 160" aria-hidden="true">
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#fff7c2"/><stop offset="100%" stop-color="#ffffff"/>
              </linearGradient>
            </defs>
            <circle class="track" cx="80" cy="80" r="${R}"></circle>
            <circle class="fill" cx="80" cy="80" r="${R}" stroke="url(#ringGrad)" stroke-dasharray="${from * CIRC} ${CIRC}" data-ring-to="${frac * CIRC} ${CIRC}"></circle>
          </svg>
          <div class="ring-center">
            <span class="ring-emoji" aria-hidden="true">${over ? '😅' : frac > 0.85 ? '🎯' : frac > 0.4 ? '😋' : '🍽️'}</span>
            <b class="ring-num" id="ring-num">${fmt(Math.abs(remaining))}</b>
            <span>${over ? 'kcal zu viel' : 'kcal übrig'}</span>
          </div>
        </div>
        <dl class="hero-stats">
          <div><dt><i aria-hidden="true">🍽️</i>Gegessen</dt><dd id="stat-eaten">${fmt(eaten.kcal)}</dd></div>
          <div><dt><i aria-hidden="true">🔥</i>Bewegung</dt><dd>+${fmt(burned)}</dd></div>
          <div><dt><i aria-hidden="true">🎯</i>Ziel</dt><dd>${fmt(t.kcal)}</dd></div>
        </dl>
      </div>
      <div class="hero-macros">
        ${macro('protein', '🥩', 'Eiweiß', 'c-protein')}
        ${macro('carbs', '🍞', 'Kohlenh.', 'c-carbs')}
        ${macro('fat', '🥑', 'Fett', 'c-fat')}
      </div>
    </section>`;
}

function buddy(tip) {
  return `
    <section class="buddy" aria-label="Tipp von Avo">
      <button class="buddy-avatar" data-action="buddy-next" aria-label="Nächster Tipp">
        <span class="buddy-face" aria-hidden="true">🥑</span><span class="buddy-mood" aria-hidden="true">${tip.mood}</span>
      </button>
      <div class="bubble" id="buddy-bubble">
        <p><b>Avo</b> · dein Buddy</p>
        <p class="bubble-text">${esc(tip.text)}</p>
        <button class="link-btn" data-action="buddy-next">Nächster Tipp ${icon('chevronRight')}</button>
      </div>
    </section>`;
}

function quickActions() {
  const tiles = [
    ['ai-open', 'photo', '📸', 'Foto-KI', 'q-orange', true],
    ['ai-open', 'text', '✨', 'Beschreiben', 'q-violet', true],
    ['open-add', '', '🔍', 'Suchen', 'q-blue', false],
    ['goto', 'dishes', '🍲', 'Gerichte', 'q-green', false],
    ['menu-scan', '', '📋', 'Speisekarte', 'q-pink', true],
    ['fridge-chef', '', '🧊', 'Kühlschrank', 'q-cyan', true],
    ['plan-open', 'plan', '🗓️', 'Essensplan', 'q-yellow', true],
    ['plan-open', 'list', '🧾', 'Einkauf', 'q-teal', false],
  ];
  return `
    <div class="quick" role="group" aria-label="Schnell eintragen">
      ${tiles
        .map(
          ([action, mode, emoji, label, cls, ai]) => `<button class="quick-btn ${cls}" data-action="${action}" ${action === 'goto' ? `data-tab="${mode}"` : action === 'plan-open' ? `data-sub="${mode}"` : mode ? `data-mode="${mode}"` : ''}>
            <span class="q-emoji" aria-hidden="true">${emoji}</span><span>${label}</span>${ai ? '<span class="q-ai">KI</span>' : ''}
          </button>`,
        )
        .join('')}
    </div>`;
}

function fitsSection(t, eaten, burned) {
  const remaining = t.kcal + burned - eaten.kcal;
  if (ui.date !== C.dateKey() || remaining < 80) return '';
  const s = store.state;
  const meal = C.mealForHour(new Date().getHours());
  const pool = [
    ...s.dishes.map((d) => {
      const ps = dishTotalsCached(d).perServing;
      return { id: d.id, name: d.name, category: 'Gerichte', kcal: ps.kcal, protein: ps.protein, amount: 1, unit: 'portion', kind: 'dish', photo: d.photo };
    }),
    ...[...s.customFoods, ...FOODS].map((f) => {
      const g = f.portion || 100;
      return { id: f.id, name: f.name, category: f.category, kcal: Math.round((f.kcal * g) / 100), protein: Math.round((f.protein * g) / 10) / 10, amount: g, unit: 'g', kind: 'food' };
    }),
  ];
  // Vorlieben: Unerwünschtes raus, Lieblingsessen bevorzugen
  const filtered = pool.map((p) => ({ ...p, ...prefFlags(p.name) })).filter((p) => !p.disliked);
  const fits = I.suggestFits({ remainingKcal: remaining, proteinGap: t.protein - eaten.protein, meal, pool: filtered });
  if (!fits.length) return '';
  return `
    <section class="fits">
      <div class="section-row"><h2>🎯 Passt noch rein</h2><span class="section-note">noch ${fmt(remaining)} kcal</span></div>
      <div class="hscroll">${fits
        .map(
          (f) => `<button class="fit-card" data-action="fit-add" data-kind="${f.kind}" data-id="${esc(f.id)}">
            ${avatar(f.name, f.photo, f.category)}
            <b>${esc(f.name)}</b>
            <small>${f.unit === 'portion' ? '1 Portion' : `${fmt(f.amount)} g`} · ${fmt(f.kcal)} kcal</small>
            <span class="fit-protein">💪 ${fmt(f.protein)} g${f.liked ? ' · 😋' : ''}</span>
          </button>`,
        )
        .join('')}</div>
    </section>`;
}

function mealCard(m, day, yesterday, t) {
  const meta = MEAL_META[m.id];
  const entries = day.meals[m.id] || [];
  const sum = C.sumNutrients(entries);
  const aim = Math.round(t.kcal * MEAL_SHARE[m.id]);
  const pct = Math.min(100, (sum.kcal / Math.max(1, aim)) * 100);
  const canCopy = !entries.length && (yesterday.meals[m.id] || []).length > 0;
  return `
    <article class="card meal meal-${meta.hue}">
      <header class="meal-head">
        <span class="meal-emoji" aria-hidden="true">${meta.emoji}</span>
        <div class="grow">
          <h3>${m.label}</h3>
          <p class="sub">${entries.length ? `${fmt(sum.kcal)} von ~${fmt(aim)} kcal · ${macroLine(sum)}` : `Empfohlen ~${fmt(aim)} kcal`}</p>
        </div>
        <button class="round-btn" data-action="open-add" data-meal="${m.id}" aria-label="${m.label}: hinzufügen">${icon('plus')}</button>
      </header>
      <div class="meal-bar ${sum.kcal > aim * 1.25 ? 'is-over' : ''}" aria-hidden="true"><i style="width:${pct}%"></i></div>
      ${
        entries.length
          ? `<ul class="rows">${entries
              .map(
                (e, i) => `<li style="--i:${i}"><button class="row" data-action="edit-entry" data-meal="${m.id}" data-id="${e.id}">
                  ${avatar(e.name, e.photo)}
                  <span class="row-main"><b>${esc(e.name)}</b><small>${amountLabel(e)}${e.source === 'ai' ? ' · <span class="ai-tag">✨ KI</span>' : ''}</small></span>
                  <span class="row-end">${fmt(e.kcal)}<small>kcal</small></span>
                </button></li>`,
              )
              .join('')}</ul>`
          : ''
      }
      ${
        canCopy || entries.length > 1
          ? `<footer class="meal-foot">
              ${canCopy ? `<button class="link-btn" data-action="copy-meal" data-meal="${m.id}">🔁 Wie gestern</button>` : ''}
              ${entries.length > 1 ? `<button class="link-btn" data-action="meal-to-dish" data-meal="${m.id}">💾 Als Gericht speichern</button>` : ''}
            </footer>`
          : ''
      }
    </article>`;
}

function waterCard(day, t) {
  const pct = Math.min(100, Math.round((day.water / t.water) * 100));
  const glassesLeft = Math.max(0, Math.ceil((t.water - day.water) / 250));
  return `
    <article class="card water-card">
      <div class="bottle" style="--fill:${pct}%" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Wasser ${pct} Prozent">
        <span class="wave" aria-hidden="true"></span><span class="wave wave2" aria-hidden="true"></span>
        <b>${pct}%</b>
      </div>
      <div class="water-info">
        <h3>💧 Wasser</h3>
        <p class="water-num"><b>${fmt(day.water / 1000, 2)}</b> / ${fmt(t.water / 1000, 1)} l</p>
        <p class="sub">${glassesLeft ? `Noch ${glassesLeft} ${glassesLeft === 1 ? 'Glas' : 'Gläser'} bis zum Ziel` : 'Ziel erreicht – super! 🎉'}</p>
        <div class="water-actions">
          <button class="pill-btn" data-action="water-add" data-ml="-250" aria-label="250 ml weniger">${icon('minus')}</button>
          <button class="pill-btn pill-water" data-action="water-add" data-ml="250">🥛 +250</button>
          <button class="pill-btn pill-water" data-action="water-add" data-ml="500">🍶 +500</button>
        </div>
      </div>
    </article>`;
}

function moodCard(day) {
  return `
    <article class="card mood-card">
      <h3>😊 Wie fühlst du dich heute?</h3>
      <div class="moods" role="radiogroup" aria-label="Stimmung">
        ${MOODS.map((m) => `<button class="mood" role="radio" aria-checked="${day.mood === m.v}" data-action="set-mood" data-v="${m.v}"><span aria-hidden="true">${m.emoji}</span><small>${m.label}</small></button>`).join('')}
      </div>
      <p class="sub">In der Statistik siehst du später, wie Essen und Stimmung zusammenhängen.</p>
    </article>`;
}

function fastingHtml() {
  const f = store.state.fasting;
  if (f.start) {
    const hours = (Date.now() - f.start) / 36e5;
    const phase = I.fastingPhase(hours, f.goalH);
    const R = 34;
    const CIRC = 2 * Math.PI * R;
    return `
      <div class="fast-active">
        <div class="fast-ring">
          <svg viewBox="0 0 80 80" aria-hidden="true"><circle class="track" cx="40" cy="40" r="${R}"></circle>
          <circle class="fill" id="fast-fill" cx="40" cy="40" r="${R}" stroke-dasharray="${Math.min(1, hours / f.goalH) * CIRC} ${CIRC}"></circle></svg>
          <span id="fast-emoji" aria-hidden="true">${phase.emoji}</span>
        </div>
        <div class="grow">
          <p class="fast-time" id="fast-time">${fastClock(hours)}</p>
          <p class="sub" id="fast-phase">${phase.text} · Ziel ${f.goalH} Std.</p>
        </div>
        <button class="btn btn-soft btn-sm" data-action="fast-stop">Beenden</button>
      </div>`;
  }
  return `
    <div class="chips">${[12, 14, 16, 18].map((h) => `<button class="chip" data-action="fast-goal" data-h="${h}" aria-pressed="${f.goalH === h}">${h}:${24 - h}</button>`).join('')}</div>
    <div class="fast-idle">
      <p class="sub">${f.last ? `Zuletzt ${fmt(f.last.hours, 1)} Std. gefastet${f.last.hours >= f.last.goalH ? ' 🏆' : ''}` : 'Starte nach deiner letzten Mahlzeit.'}</p>
      <button class="btn btn-primary btn-sm" data-action="fast-start">⏱️ Fasten starten</button>
    </div>`;
}

function fastClock(hours) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = Math.floor(((hours - h) * 60 - m) * 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function movementCard(day) {
  const burned = day.workouts.reduce((s, w) => s + w.kcal, 0);
  return `
    <article class="card meal meal-move">
      <header class="meal-head">
        <span class="meal-emoji" aria-hidden="true">🏃</span>
        <div class="grow">
          <h3>Bewegung</h3>
          <p class="sub">${day.workouts.length ? `${fmt(burned)} kcal verbrannt 🔥` : 'Noch kein Training – jede Minute zählt!'}</p>
        </div>
        <button class="round-btn" data-action="goto" data-tab="training" aria-label="Training eintragen">${icon('plus')}</button>
      </header>
      ${
        day.workouts.length
          ? `<ul class="rows">${day.workouts
              .map(
                (w) => `<li><div class="row">
                  <span class="thumb thumb-emoji" style="--h:25" aria-hidden="true">${w.type === 'strength' ? '🏋️' : CARDIO_EMOJI[w.activity] || '🏃'}</span>
                  <span class="row-main"><b>${esc(w.name)}</b><small>${fmt(w.minutes)} Min.${w.type === 'strength' ? ` · ${w.exercises.length} Übungen` : ''}</small></span>
                  <span class="row-end">${fmt(w.kcal)}<small>kcal</small></span>
                </div></li>`,
              )
              .join('')}</ul>`
          : ''
      }
    </article>`;
}

export function todayContext(key = ui.date) {
  const s = store.state;
  const t = targets();
  const { day, eaten, burned } = dayTotals(key);
  const mealsLogged = S.MEALS.filter((m) => (day.meals[m.id] || []).length).length;
  const score = I.dayScore({ eaten, burned, target: t, water: day.water, mealsLogged });
  return { s, t, day, eaten, burned, mealsLogged, score };
}

views.today = (root) => {
  const { s, t, day, eaten, burned, mealsLogged, score } = todayContext();
  const yesterday = S.peekDay(s, C.addDays(ui.date, -1));
  const p = profile();
  const now = new Date();
  const today = C.dateKey();
  const streak = C.streak((k) => S.hasActivity(s, k), today);
  const tips = I.buddyTips({
    hour: now.getHours(), isToday: ui.date === today, name: s.profile ? p.name : '', eaten, burned, target: t,
    water: day.water, mealsLogged, streak, weight: currentWeight(), seed: now.getDate(),
  });
  const tip = tips[tipIndex % tips.length];
  const initial = s.profile && p.name ? esc(p.name.charAt(0).toUpperCase()) : '👤';

  root.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">📅 ${esc(dateLabel(ui.date, true))}${ui.date !== today ? ` · <button class="link-inline" data-action="pick-day" data-date="${today}">zu heute</button>` : ''}</p>
        <h1>${esc(C.greeting(now.getHours()))}${p.name && s.profile ? `, ${esc(p.name)}` : ''} <span class="wave-hand" aria-hidden="true">👋</span></h1>
      </div>
      <div class="head-actions">
        <button class="streak-pill ${streak ? '' : 'is-zero'}" data-action="goto" data-tab="stats" aria-label="${streak} Tage Serie"><span aria-hidden="true">🔥</span><b>${streak}</b></button>
        <button class="avatar-btn" data-action="goto" data-tab="profile" aria-label="Profil und Einstellungen">${initial}</button>
      </div>
    </header>
    ${weekStrip(t)}
    ${
      s.profile
        ? ''
        : `<div class="notice"><b>🎯 Beispielziele aktiv</b><p>Richte in einer Minute dein Profil ein, dann passen Kalorien- und Nährstoffziele zu dir.</p><button class="btn btn-primary btn-sm" data-action="onboard-open">Profil einrichten</button></div>`
    }
    ${hero(t, eaten, burned, score)}
    ${buddy(tip)}
    ${quickActions()}
    ${fitsSection(t, eaten, burned)}
    ${S.MEALS.map((m) => mealCard(m, day, yesterday, t)).join('')}
    ${waterCard(day, t)}
    ${ui.date === today ? `<article class="card fast-card"><header class="meal-head"><span class="meal-emoji" aria-hidden="true">⏱️</span><div class="grow"><h3>Intervallfasten</h3><p class="sub">Essenspause mit Live-Timer</p></div></header><div id="fast-box">${fastingHtml()}</div></article>` : ''}
    ${moodCard(day)}
    ${movementCard(day)}`;

  const remaining = t.kcal + burned - eaten.kcal;
  countUp($('#ring-num'), `rem:${ui.date}`, Math.abs(remaining));
  countUp($('#stat-eaten'), `eat:${ui.date}`, eaten.kcal);
  playRings(root);
};

// ---------- Fasten-Timer ----------

setInterval(() => {
  const f = store.state.fasting;
  if (ui.tab !== 'today' || !f?.start) return;
  const el = $('#fast-time');
  if (!el) return;
  const hours = (Date.now() - f.start) / 36e5;
  el.textContent = fastClock(hours);
  const phase = I.fastingPhase(hours, f.goalH);
  $('#fast-emoji').textContent = phase.emoji;
  $('#fast-phase').textContent = `${phase.text} · Ziel ${f.goalH} Std.`;
  const c = $('#fast-fill');
  const CIRC = 2 * Math.PI * 34;
  c?.setAttribute('stroke-dasharray', `${Math.min(1, hours / f.goalH) * CIRC} ${CIRC}`);
}, 1000);

actions['fast-goal'] = (d) => {
  store.state.fasting.goalH = Number(d.h);
  commit();
};
actions['fast-start'] = () => {
  store.state.fasting.start = Date.now();
  haptic(20);
  toast(`⏱️ Fasten gestartet – Ziel ${store.state.fasting.goalH} Stunden`);
  commit();
};
actions['fast-stop'] = () => {
  const f = store.state.fasting;
  const hours = (Date.now() - f.start) / 36e5;
  f.last = { hours: Math.round(hours * 10) / 10, goalH: f.goalH, end: Date.now() };
  f.longestH = Math.max(f.longestH || 0, hours);
  f.start = null;
  if (hours >= f.last.goalH) {
    confetti({ emojis: ['🏆', '⏱️', '✨'] });
    toast(`🏆 ${fmt(hours, 1)} Stunden gefastet – Ziel erreicht!`);
  } else toast(`${fmt(hours, 1)} Stunden gefastet`);
  commit();
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
  const t = targets();
  const day = S.getDay(store.state, ui.date);
  const before = day.water;
  day.water = Math.max(0, day.water + Number(d.ml));
  haptic();
  if (before < t.water && day.water >= t.water) {
    confetti({ emojis: ['💧', '💦', '🌊'], count: 70 });
    toast('💧 Wasserziel geschafft!');
  }
  commit();
};
actions['copy-meal'] = (d) => {
  const src = S.peekDay(store.state, C.addDays(ui.date, -1)).meals[d.meal] || [];
  S.getDay(store.state, ui.date).meals[d.meal] = src.map((e) => ({ ...e, id: S.uid() }));
  toast('🔁 Von gestern übernommen');
  commit();
};
actions['buddy-next'] = () => {
  tipIndex++;
  haptic(8);
  commit();
  $('#buddy-bubble')?.classList.add('pop');
};
actions['set-mood'] = (d) => {
  const day = S.getDay(store.state, ui.date);
  const v = Number(d.v);
  day.mood = day.mood === v ? undefined : v;
  haptic(10);
  save();
  document.querySelectorAll('[data-action="set-mood"]').forEach((b) => b.setAttribute('aria-checked', Number(b.dataset.v) === day.mood));
  if (day.mood) toast(`${MOODS[v - 1].emoji} Stimmung gespeichert`);
};
actions['fit-add'] = (d) => {
  const s = store.state;
  if (d.kind === 'dish') {
    const dish = s.dishes.find((x) => x.id === d.id);
    if (dish) pickDish(dish, C.mealForHour(new Date().getHours()));
    return;
  }
  const f = [...s.customFoods, ...FOODS].find((x) => x.id === d.id);
  if (f) pickFood(f, C.mealForHour(new Date().getHours()));
};

actions['score-info'] = () => {
  const { score } = todayContext();
  openSheet('Dein Tages-Score', `
    <div class="score-hero">
      <span class="score-big-emoji" aria-hidden="true">${score.emoji}</span>
      <b class="score-big">${score.total}<small>/100</small></b>
      <p>${score.grade}</p>
    </div>
    <ul class="score-parts">${score.parts
      .map((p) => `<li><span class="sp-emoji" aria-hidden="true">${p.emoji}</span><div class="grow"><div class="sp-top"><span>${p.label}</span><b>${p.pts}/${p.max}</b></div><div class="sp-track"><i style="width:${(p.pts / p.max) * 100}%"></i></div></div></li>`)
      .join('')}</ul>
    <p class="hint">Der Score bewertet, wie ausgewogen dein Tag ist: im Kalorienziel bleiben, genug Eiweiß und Wasser, Bewegung und regelmäßig eintragen.</p>`);
};
