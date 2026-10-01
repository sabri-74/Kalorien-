// Abzeichen: sammeln, anzeigen, feiern.

import { store, C, S, esc, commit, toast, targets } from '../core.js';
import * as I from '../insights.js';
import { foodEmoji } from '../emoji.js';
import { confetti } from '../fx.js';

const GREEN = new Set(['🥦', '🥕', '🥒', '🍅', '🫑', '🥬', '🥗', '🍄', '🧅', '🧄', '🫛', '🌽', '🥑', '🍎', '🍌', '🍊', '🍐', '🍓', '🫐', '🍇', '🥝', '🥭', '🍍', '🍉']);

/** Kennzahlen über alle Tage für die Abzeichen. */
export function collectSummary() {
  const s = store.state;
  const t = targets();
  const sum = { entries: 0, photoMeals: 0, bestStreak: 0, waterDays: 0, proteinDays: 0, onTargetDays: 0, dishes: s.dishes.length, workouts: 0, veggies: 0, bestScore: 0, longestFastH: s.fasting?.longestH || 0, moodDays: 0 };
  const photos = new Set();
  const active = [];
  for (const [key, day] of Object.entries(s.days)) {
    const entries = S.dayEntries(day);
    sum.entries += entries.length;
    sum.workouts += day.workouts.length;
    if (day.mood) sum.moodDays++;
    if (entries.length || day.workouts.length) active.push(key);
    for (const e of entries) {
      if (e.source === 'ai' && e.photo) photos.add(e.photo);
      if (GREEN.has(foodEmoji(e.name))) sum.veggies++;
    }
    const eaten = C.sumNutrients(entries);
    const burned = day.workouts.reduce((a, w) => a + (w.kcal || 0), 0);
    const meals = S.MEALS.filter((m) => (day.meals[m.id] || []).length).length;
    if (day.water >= t.water) sum.waterDays++;
    if (eaten.protein >= t.protein) sum.proteinDays++;
    const budget = t.kcal + burned;
    if (meals >= 3 && eaten.kcal >= budget * 0.85 && eaten.kcal <= budget * 1.05) sum.onTargetDays++;
    sum.bestScore = Math.max(sum.bestScore, I.dayScore({ eaten, burned, target: t, water: day.water, mealsLogged: meals }).total);
  }
  sum.photoMeals = photos.size;
  sum.bestStreak = I.longestStreak(active);
  return sum;
}

/** Neue Abzeichen erkennen und feiern. */
export function checkBadges() {
  const s = store.state;
  const earned = I.earnedBadges(collectSummary());
  const fresh = [...earned].filter((id) => !s.badges.includes(id));
  if (!fresh.length) return;
  s.badges.push(...fresh);
  commit();
  const list = fresh.map((id) => I.BADGES.find((b) => b.id === id)).filter(Boolean);
  confetti({ emojis: list.map((b) => b.emoji).concat('🏅', '✨') });
  toast(list.length === 1 ? `🏅 Neues Abzeichen: ${list[0].emoji} ${list[0].title}` : `🏅 ${list.length} neue Abzeichen freigeschaltet!`);
}

export function badgeGridHtml() {
  const got = new Set(store.state.badges);
  return `<div class="badges">${I.BADGES.map((b) => {
    const has = got.has(b.id);
    return `<div class="badge ${has ? 'is-earned' : 'is-locked'}" title="${esc(b.desc)}">
      <span class="badge-emoji" aria-hidden="true">${has ? b.emoji : '🔒'}</span>
      <b>${esc(b.title)}</b>
      <small>${esc(b.desc)}</small>
    </div>`;
  }).join('')}</div>`;
}
