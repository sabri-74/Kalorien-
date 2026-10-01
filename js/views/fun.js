// Spaß-Funktionen: Level & XP, Wochen-Challenges, Wochen-Rückblick (Story),
// Glücksrad „Was esse ich?“ und Farbwelten.

import {
  store, ui, C, $, esc, fmt, actions, openSheet, setSheet, closeSheet, commit, save, toast, haptic, targets, dayTotals,
  dishTotalsCached,
} from '../core.js';
import * as G from '../game.js';
import { FOODS } from '../foods.js';
import { foodEmoji } from '../emoji.js';
import { prefFlags } from './prefs.js';
import { pickFood, pickDish } from './food.js';
import { confetti } from '../fx.js';

// ---------- Farbwelten ----------

export const PALETTES = {
  sunset: { emoji: '🌅', label: 'Sunset', css: 'linear-gradient(135deg,#7c3aed,#c026d3,#f97316)' },
  ocean: { emoji: '🌊', label: 'Ozean', css: 'linear-gradient(135deg,#2563eb,#0891b2,#22d3ee)' },
  jungle: { emoji: '🌿', label: 'Dschungel', css: 'linear-gradient(135deg,#15803d,#0d9488,#a3e635)' },
  candy: { emoji: '🍬', label: 'Candy', css: 'linear-gradient(135deg,#ec4899,#a855f7,#f9a8d4)' },
  galaxy: { emoji: '🌌', label: 'Galaxie', css: 'linear-gradient(135deg,#312e81,#7e22ce,#06b6d4)' },
  fire: { emoji: '🔥', label: 'Feuer', css: 'linear-gradient(135deg,#dc2626,#f97316,#facc15)' },
};

export function paletteHtml() {
  const cur = store.state.settings.palette || 'sunset';
  return `<div class="palettes" role="radiogroup" aria-label="Farbwelt">${Object.entries(PALETTES)
    .map(([id, p]) => `<button class="palette" role="radio" aria-checked="${id === cur}" data-action="palette" data-id="${id}">
      <span class="palette-swatch" style="background:${p.css}" aria-hidden="true">${p.emoji}</span><small>${p.label}</small></button>`)
    .join('')}</div>`;
}

actions.palette = (d) => {
  store.state.settings.palette = d.id;
  haptic(12);
  commit();
  confetti({ count: 40, emojis: [PALETTES[d.id].emoji] });
  toast(`${PALETTES[d.id].emoji} Farbwelt „${PALETTES[d.id].label}“ aktiv`);
};

// ---------- Level & Challenges ----------

export function levelInfo() {
  const s = store.state;
  return G.levelFromXp(G.totalXp(s.days, targets(), s.badges.length));
}

export function weekChallenges() {
  const start = G.weekStart(C.dateKey());
  const t = targets();
  const keys = Array.from({ length: 7 }, (_, i) => C.addDays(start, i));
  return G.challengeProgress(keys.map((k) => G.daySummary(store.state.days[k], t)));
}

export function levelChipHtml() {
  const l = levelInfo();
  return `<button class="level-chip" data-action="level-open" aria-label="Level ${l.level}, ${l.title}" style="--lp:${Math.round(l.progress * 100)}%">
    <span class="level-ring" aria-hidden="true"><b>${l.level}</b></span><span class="level-emoji" aria-hidden="true">${l.emoji}</span>
  </button>`;
}

function challengeRow(c) {
  return `<li class="ch ${c.done ? 'is-done' : ''}">
    <span class="ch-emoji" aria-hidden="true">${c.done ? '✅' : c.emoji}</span>
    <div class="grow"><div class="ch-top"><b>${c.title}</b><span>${c.value}/${c.goal}</span></div>
      <small>${c.desc} · +${c.xp} XP</small>
      <div class="ch-track"><i style="width:${(c.value / c.goal) * 100}%"></i></div></div>
  </li>`;
}

export function challengesCardHtml() {
  const list = weekChallenges();
  const done = list.filter((c) => c.done).length;
  return `<article class="card challenges">
    <header class="meal-head">
      <span class="meal-emoji" aria-hidden="true">🏆</span>
      <div class="grow"><h3>Wochen-Challenges</h3><p class="sub">${done} von ${list.length} geschafft · neue Woche ab Montag</p></div>
      <button class="btn btn-soft btn-sm" data-action="wrapped-open">🎁 Rückblick</button>
    </header>
    <ul class="ch-list">${list.map(challengeRow).join('')}</ul>
  </article>`;
}

actions['level-open'] = () => {
  const l = levelInfo();
  const next = G.levelFromXp(G.xpForLevel(l.level + 1));
  openSheet('Dein Level', `
    <div class="level-hero">
      <span class="level-big-emoji" aria-hidden="true">${l.emoji}</span>
      <p class="eyebrow">Level ${l.level}</p>
      <h2>${l.title}</h2>
      <div class="xp-bar"><i style="width:${Math.round(l.progress * 100)}%"></i></div>
      <p class="hint">${fmt(l.into)} / ${fmt(l.need)} XP bis Level ${l.level + 1}${next.title !== l.title ? ` (${next.emoji} ${next.title})` : ''} · gesamt ${fmt(l.xp)} XP</p>
    </div>
    <section><h4 class="eyebrow">⚡ So sammelst du XP</h4>
      <ul class="xp-rules">
        <li><span>🍽️ Mahlzeit eingetragen</span><b>+10</b></li>
        <li><span>🎯 Tag im Kalorienziel</span><b>+30</b></li>
        <li><span>💪 Eiweißziel erreicht</span><b>+20</b></li>
        <li><span>💧 Wasserziel erreicht</span><b>+20</b></li>
        <li><span>🏃 Training</span><b>+25</b></li>
        <li><span>📸 KI-Eintrag</span><b>+5</b></li>
        <li><span>🏅 Abzeichen</span><b>+50</b></li>
        <li><span>🏆 Wochen-Challenge</span><b>+80 bis 150</b></li>
      </ul>
    </section>
    <section><h4 class="eyebrow">🏆 Diese Woche</h4><ul class="ch-list">${weekChallenges().map(challengeRow).join('')}</ul></section>`);
};

// Level-Aufstieg feiern
let lastLevel = null;
export function checkLevelUp() {
  const l = levelInfo();
  if (lastLevel !== null && l.level > lastLevel) {
    confetti({ count: 120, emojis: [l.emoji, '⭐', '🎉'] });
    toast(`${l.emoji} Level ${l.level} erreicht: ${l.title}!`);
  }
  lastLevel = l.level;
}

// ---------- Wochen-Rückblick (Story) ----------

let story = { slides: [], i: 0, timer: null };

function wrappedSlides() {
  const s = store.state;
  const t = targets();
  const keys = C.lastDays(C.dateKey(), 7);
  const w = G.weekWrapped(s.days, keys, t, foodEmoji);
  const l = levelInfo();
  const best = w.bestDay ? C.parseKey(w.bestDay.key).toLocaleDateString('de-DE', { weekday: 'long' }) : null;
  const slides = [
    { bg: 'linear-gradient(160deg,#7c3aed,#db2777)', emoji: '🎁', kicker: 'Deine letzten 7 Tage', big: 'Dein Wochen-Rückblick', text: 'Tipp auf die rechte Seite für weiter.' },
    { bg: 'linear-gradient(160deg,#f97316,#db2777)', emoji: '📝', kicker: 'Eingetragen an', big: `${w.daysLogged} von 7 Tagen`, text: w.daysLogged >= 6 ? 'Mega konsequent! 🔥' : w.daysLogged >= 3 ? 'Gute Basis – da geht noch mehr!' : 'Jeder Eintrag zählt. Nächste Woche packst du mehr!' },
    { bg: 'linear-gradient(160deg,#0891b2,#6366f1)', emoji: '🍽️', kicker: 'Du hast gegessen', big: `${fmt(w.kcal)} kcal`, text: `Im Schnitt ${fmt(w.avgKcal)} kcal pro Tag · Ziel ${fmt(t.kcal)} kcal` },
    { bg: 'linear-gradient(160deg,#16a34a,#0d9488)', emoji: '🎯', kicker: 'Tage im Kalorienziel', big: `${w.onTargetDays} ${w.onTargetDays === 1 ? 'Tag' : 'Tage'}`, text: `Dazu ${fmt(w.protein)} g Eiweiß gegessen 💪` },
  ];
  if (w.topFood) slides.push({ bg: 'linear-gradient(160deg,#eab308,#f97316)', emoji: w.topFood.emoji, kicker: 'Dein Lieblingsessen', big: esc(w.topFood.name), text: `${w.topFood.times}× gegessen · insgesamt ${w.foods} verschiedene Lebensmittel` });
  slides.push({ bg: 'linear-gradient(160deg,#0ea5e9,#2563eb)', emoji: '💧', kicker: 'Getrunken', big: `${fmt(w.waterL, 1)} Liter`, text: w.waterL >= (t.water / 1000) * 5 ? 'Hydro-Held! 🌊' : 'Ein Glas mehr am Tag macht den Unterschied.' });
  slides.push({ bg: 'linear-gradient(160deg,#e11d48,#7c3aed)', emoji: '🔥', kicker: 'Bewegung', big: `${w.workouts} ${w.workouts === 1 ? 'Training' : 'Trainings'}`, text: w.burned ? `${fmt(w.burned)} kcal verbrannt` : 'Diese Woche ist die perfekte Gelegenheit! 🏃' });
  if (best) slides.push({ bg: 'linear-gradient(160deg,#a855f7,#ec4899)', emoji: '🌟', kicker: 'Dein bester Tag', big: best, text: `${w.bestDay.xp} XP an einem Tag – stark!` });
  slides.push({ bg: 'linear-gradient(160deg,#312e81,#9333ea,#06b6d4)', emoji: l.emoji, kicker: `+${fmt(w.xp)} XP diese Woche`, big: `Level ${l.level}`, text: `${l.title} · weiter so!`, last: true, summary: w });
  return slides;
}

function renderStory() {
  const sl = story.slides[story.i];
  $('#story-body').innerHTML = `
    <div class="story-bars">${story.slides.map((_, i) => `<i class="${i < story.i ? 'done' : i === story.i ? 'run' : ''}"></i>`).join('')}</div>
    <button class="story-close" data-action="wrapped-close" aria-label="Schließen">✕</button>
    <div class="story-slide" style="background:${sl.bg}">
      <span class="story-emoji" aria-hidden="true">${sl.emoji}</span>
      <p class="story-kicker">${sl.kicker}</p>
      <h2 class="story-big">${sl.big}</h2>
      <p class="story-text">${sl.text}</p>
      ${sl.last ? '<button class="btn story-share" data-action="wrapped-share">📤 Rückblick teilen</button>' : ''}
    </div>
    <button class="story-nav story-prev" data-action="wrapped-prev" aria-label="Zurück"></button>
    <button class="story-nav story-next" data-action="wrapped-next" aria-label="Weiter"></button>`;
  clearTimeout(story.timer);
  if (!sl.last) story.timer = setTimeout(() => actions['wrapped-next'](), 4500);
  else confetti({ count: 100, emojis: ['🎉', '⭐', sl.emoji] });
}

actions['wrapped-open'] = () => {
  closeSheet();
  let dlg = $('#story');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'story';
    dlg.className = 'story';
    dlg.setAttribute('aria-label', 'Wochen-Rückblick');
    dlg.innerHTML = '<div id="story-body" class="story-inner"></div>';
    dlg.addEventListener('close', () => clearTimeout(story.timer));
    document.body.appendChild(dlg);
  }
  story = { slides: wrappedSlides(), i: 0, timer: null };
  dlg.showModal();
  renderStory();
};
actions['wrapped-next'] = () => {
  if (story.i < story.slides.length - 1) {
    story.i++;
    haptic(6);
    renderStory();
  }
};
actions['wrapped-prev'] = () => {
  if (story.i > 0) story.i--;
  renderStory();
};
actions['wrapped-close'] = () => $('#story')?.close();
actions['wrapped-share'] = async () => {
  const w = story.slides.at(-1).summary;
  const l = levelInfo();
  const text = `🎁 Meine Woche mit Kalorien & Fitness\n📝 ${w.daysLogged}/7 Tage eingetragen\n🎯 ${w.onTargetDays} Tage im Ziel\n💪 ${fmt(w.protein)} g Eiweiß\n💧 ${fmt(w.waterL, 1)} l Wasser\n🔥 ${w.workouts} Trainings\n${w.topFood ? `${w.topFood.emoji} Lieblingsessen: ${w.topFood.name}\n` : ''}${l.emoji} Level ${l.level} – ${l.title}`;
  try {
    if (navigator.share) return await navigator.share({ title: 'Mein Wochen-Rückblick', text });
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('📋 Rückblick kopiert – jetzt einfach teilen');
  } catch {
    toast('Teilen nicht möglich – mach einfach einen Screenshot 📸');
  }
};

// ---------- Glücksrad ----------

const WHEEL_COLORS = ['#f97316', '#ec4899', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#eab308', '#ef4444'];
const WHEEL_CATS = ['Gerichte', 'Fleisch & Fisch', 'Getreide', 'Milch & Ei', 'Hülsenfrüchte', 'Obst'];
let wheel = { items: [], angle: 0, spinning: false, pick: null };

function wheelCandidates() {
  const t = targets();
  const { eaten, burned } = dayTotals(C.dateKey());
  const remaining = Math.max(250, t.kcal + burned - eaten.kcal);
  const s = store.state;
  const dishes = s.dishes
    .map((d) => ({ kind: 'dish', id: d.id, name: d.name, kcal: dishTotalsCached(d).perServing.kcal }))
    .filter((d) => d.kcal <= remaining && !prefFlags(d.name).disliked);
  const foods = [...s.customFoods, ...FOODS]
    .filter((f) => WHEEL_CATS.includes(f.category) && !/roh\)|öl|butter|zucker/i.test(f.name))
    .map((f) => ({ kind: 'food', id: f.id, name: f.name, kcal: Math.round((f.kcal * (f.portion || 100)) / 100) }))
    .filter((f) => f.kcal >= 120 && f.kcal <= remaining && !prefFlags(f.name).disliked);
  const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
  const liked = shuffle(foods.filter((f) => prefFlags(f.name).liked));
  return [...shuffle(dishes).slice(0, 4), ...liked.slice(0, 2), ...shuffle(foods)].filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).slice(0, 8);
}

function wheelSvg(items) {
  const n = items.length;
  const R = 150;
  const seg = (2 * Math.PI) / n;
  return `<svg viewBox="-160 -160 320 320" class="wheel-svg" aria-hidden="true">${items
    .map((it, i) => {
      const a0 = i * seg - Math.PI / 2;
      const a1 = a0 + seg;
      const p = (a) => `${Math.cos(a) * R},${Math.sin(a) * R}`;
      const mid = a0 + seg / 2;
      const tx = Math.cos(mid) * R * 0.66;
      const ty = Math.sin(mid) * R * 0.66;
      return `<path d="M0,0 L${p(a0)} A${R},${R} 0 0 1 ${p(a1)} Z" fill="${WHEEL_COLORS[i % 8]}" stroke="#fff" stroke-width="3"/>
        <text x="${tx}" y="${ty}" font-size="34" text-anchor="middle" dominant-baseline="central">${foodEmoji(it.name, it.kind === 'dish' ? 'Gerichte' : '')}</text>`;
    })
    .join('')}<circle r="26" fill="#fff"/><text font-size="26" text-anchor="middle" dominant-baseline="central">🎡</text></svg>`;
}

function wheelHtml() {
  return `
    <p class="hint center">Alles auf dem Rad passt noch in dein heutiges Budget${store.state.prefs?.dislikes?.length ? ' und beachtet deine Vorlieben' : ''}.</p>
    <div class="wheel-wrap">
      <span class="wheel-pointer" aria-hidden="true">▼</span>
      <div class="wheel" id="wheel" style="transform:rotate(${wheel.angle}deg)">${wheelSvg(wheel.items)}</div>
    </div>
    <div id="wheel-result" aria-live="polite"></div>
    <div class="sheet-actions">
      <button class="btn btn-ghost btn-square" data-action="wheel-shuffle" aria-label="Neue Auswahl" title="Neue Auswahl">🔀</button>
      <button class="btn btn-primary btn-lg" data-action="wheel-spin" id="wheel-spin">🎡 Drehen!</button>
    </div>`;
}

actions['wheel-open'] = () => {
  wheel = { items: wheelCandidates(), angle: 0, spinning: false, pick: null };
  if (wheel.items.length < 2) {
    toast('Für heute passt kaum noch etwas ins Budget – trink lieber ein Glas Wasser 💧');
    return;
  }
  openSheet('🎡 Was esse ich?', wheelHtml());
};
actions['wheel-shuffle'] = () => {
  if (wheel.spinning) return;
  wheel.items = wheelCandidates();
  wheel.angle = 0;
  setSheet(null, wheelHtml());
};
actions['wheel-spin'] = () => {
  if (wheel.spinning) return;
  wheel.spinning = true;
  const n = wheel.items.length;
  const idx = Math.floor(Math.random() * n);
  const seg = 360 / n;
  // Zeiger oben: Mitte des gewählten Segments nach oben drehen
  const target = 360 - (idx * seg + seg / 2);
  wheel.angle = wheel.angle - (wheel.angle % 360) + 360 * 6 + target;
  const el = $('#wheel');
  $('#wheel-spin').disabled = true;
  $('#wheel-result').innerHTML = '';
  el.style.transform = `rotate(${wheel.angle}deg)`;
  haptic(20);
  const done = () => {
    wheel.spinning = false;
    wheel.pick = wheel.items[idx];
    const it = wheel.pick;
    haptic([30, 40, 30]);
    confetti({ count: 70, emojis: [foodEmoji(it.name), '🎉'] });
    const box = $('#wheel-result');
    if (box) {
      box.innerHTML = `<div class="wheel-win"><span aria-hidden="true">${foodEmoji(it.name, it.kind === 'dish' ? 'Gerichte' : '')}</span><div class="grow"><small>Das Rad sagt:</small><b>${esc(it.name)}</b><small>${fmt(it.kcal)} kcal${it.kind === 'dish' ? ' · 1 Portion' : ''}</small></div>
        <button class="btn btn-primary btn-sm" data-action="wheel-take">Nehmen!</button></div>`;
    }
    const b = $('#wheel-spin');
    if (b) {
      b.disabled = false;
      b.textContent = '🎡 Nochmal';
    }
  };
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced) done();
  else el.addEventListener('transitionend', done, { once: true });
};
actions['wheel-take'] = () => {
  const it = wheel.pick;
  if (!it) return;
  const meal = C.mealForHour(new Date().getHours());
  if (it.kind === 'dish') {
    const d = store.state.dishes.find((x) => x.id === it.id);
    if (d) pickDish(d, meal);
  } else {
    const f = [...store.state.customFoods, ...FOODS].find((x) => x.id === it.id);
    if (f) pickFood(f, meal);
  }
};

export { save, ui };
