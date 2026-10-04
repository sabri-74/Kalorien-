// Spielelemente ohne DOM: XP, Level, Wochen-Challenges und Wochen-Rückblick.

import * as C from './calc.js';

const MEAL_IDS = ['breakfast', 'lunch', 'dinner', 'snacks'];

/** Kennzahlen eines Tages für XP, Challenges und Rückblick. */
export function daySummary(day, target) {
  const entries = MEAL_IDS.flatMap((m) => day?.meals?.[m] || []);
  const eaten = C.sumNutrients(entries);
  const burned = (day?.workouts || []).reduce((s, w) => s + (w.kcal || 0), 0);
  const meals = MEAL_IDS.filter((m) => (day?.meals?.[m] || []).length).length;
  const budget = target.kcal + burned;
  return {
    entries,
    eaten,
    burned,
    meals,
    logged: entries.length > 0,
    water: day?.water || 0,
    waterGoal: (day?.water || 0) >= target.water,
    proteinGoal: eaten.protein >= target.protein,
    onTarget: meals >= 2 && eaten.kcal >= budget * 0.85 && eaten.kcal <= budget * 1.05,
    workouts: (day?.workouts || []).length,
    mood: day?.mood || 0,
    aiEntries: entries.filter((e) => e.source === 'ai').length,
  };
}

/** XP für einen Tag (max. 160). */
export function dayXp(s) {
  return (
    Math.min(4, s.meals) * 10 +
    (s.waterGoal ? 20 : 0) +
    (s.proteinGoal ? 20 : 0) +
    (s.onTarget ? 30 : 0) +
    (s.workouts ? 25 : 0) +
    (s.mood ? 5 : 0) +
    Math.min(3, s.aiEntries) * 5 + (s.logged ? 5 : 0)
  );
}

const TITLES = [
  [1, '🌱', 'Anfänger'],
  [3, '🚀', 'Durchstarter'],
  [5, '🥗', 'Ernährungs-Profi'],
  [8, '💪', 'Fitness-Held'],
  [12, '🔥', 'Unaufhaltsam'],
  [16, '👑', 'Legende'],
  [25, '⚡', 'Gottmodus'],
];

/** XP, die man insgesamt für ein Level braucht: 0, 100, 300, 600 … */
export const xpForLevel = (level) => 50 * (level - 1) * level;

export function levelFromXp(xp) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const [, emoji, title] = [...TITLES].reverse().find(([l]) => level >= l);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return { level, emoji, title, xp, into: xp - from, need: to - from, progress: (xp - from) / (to - from) };
}

/** Montag der Woche, in der `key` liegt. */
export function weekStart(key) {
  const d = C.parseKey(key);
  return C.addDays(key, -((d.getDay() + 6) % 7));
}

export const CHALLENGES = [
  { id: 'water', emoji: '💧', title: 'Hydro-Woche', desc: 'Wasserziel an 5 Tagen', goal: 5, xp: 100, count: (s) => s.waterGoal },
  { id: 'protein', emoji: '💪', title: 'Eiweiß-Power', desc: 'Eiweißziel an 4 Tagen', goal: 4, xp: 100, count: (s) => s.proteinGoal },
  { id: 'move', emoji: '🏃', title: 'Beweg dich', desc: '3 Trainings in dieser Woche', goal: 3, xp: 120, count: (s) => s.workouts },
  { id: 'target', emoji: '🎯', title: 'Zielgenau', desc: '4 Tage im Kalorienziel', goal: 4, xp: 150, count: (s) => s.onTarget },
  { id: 'log', emoji: '📝', title: 'Dranbleiber', desc: 'An 6 Tagen eintragen', goal: 6, xp: 80, count: (s) => s.logged },
];

/** Fortschritt der Wochen-Challenges. summaries: Liste von daySummary für Mo–So. */
export function challengeProgress(summaries) {
  return CHALLENGES.map((c) => {
    const value = summaries.reduce((a, s) => a + Number(c.count(s) || 0), 0);
    return { ...c, value: Math.min(c.goal, value), done: value >= c.goal };
  });
}

/** Gesamte XP aus allen Tagen, abgeschlossenen Challenges und Abzeichen. */
export function totalXp(days, target, badgeCount = 0) {
  const keys = Object.keys(days).sort();
  let xp = badgeCount * 50;
  const weeks = new Map();
  for (const k of keys) {
    const s = daySummary(days[k], target);
    xp += dayXp(s);
    const w = weekStart(k);
    if (!weeks.has(w)) weeks.set(w, []);
    weeks.get(w).push(s);
  }
  for (const list of weeks.values()) xp += challengeProgress(list).filter((c) => c.done).reduce((a, c) => a + c.xp, 0);
  return xp;
}

/** Zahlen für den Wochen-Rückblick über die Tage `keys`. */
export function weekWrapped(days, keys, target, foodEmoji) {
  const rows = keys.map((k) => ({ key: k, ...daySummary(days[k], target) }));
  const logged = rows.filter((r) => r.logged);
  const counts = new Map();
  for (const r of rows) for (const e of r.entries) counts.set(e.name, (counts.get(e.name) || 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const best = [...logged].sort((a, b) => dayXp(b) - dayXp(a))[0];
  const sum = (f) => rows.reduce((a, r) => a + f(r), 0);
  return {
    daysLogged: logged.length,
    kcal: Math.round(sum((r) => r.eaten.kcal)),
    avgKcal: logged.length ? Math.round(sum((r) => r.eaten.kcal) / logged.length) : 0,
    protein: Math.round(sum((r) => r.eaten.protein)),
    waterL: Math.round(sum((r) => r.water) / 100) / 10,
    workouts: sum((r) => r.workouts),
    burned: Math.round(sum((r) => r.burned)),
    onTargetDays: rows.filter((r) => r.onTarget).length,
    xp: sum((r) => dayXp(r)),
    topFood: top ? { name: top[0], times: top[1], emoji: foodEmoji ? foodEmoji(top[0]) : '🍽️' } : null,
    bestDay: best ? { key: best.key, xp: dayXp(best) } : null,
    foods: counts.size,
  };
}
