import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as I from '../js/insights.js';
import { foodEmoji } from '../js/emoji.js';
import { FOODS } from '../js/foods.js';

const target = { kcal: 2000, protein: 120, carbs: 200, fat: 60, water: 2500 };

test('Tages-Score', () => {
  const perfect = I.dayScore({ eaten: { kcal: 2250, protein: 125 }, burned: 300, target, water: 2600, mealsLogged: 4 });
  assert.equal(perfect.total, 100);
  assert.equal(perfect.emoji, '🤩');
  const empty = I.dayScore({ eaten: { kcal: 0, protein: 0 }, burned: 0, target, water: 0, mealsLogged: 0 });
  assert.equal(empty.total, 0);
  const over = I.dayScore({ eaten: { kcal: 2800, protein: 60 }, burned: 0, target, water: 1250, mealsLogged: 3 });
  // 2800/2000 = 1.4 → Kalorienpunkte 0; Eiweiß 10; Wasser 8; Bewegung 0; Einträge 10
  assert.equal(over.total, 28);
});

test('Verbrenn-Rechner', () => {
  const [walk, , jog] = I.burnEquivalents(300, 70);
  // Gehen: 3,5 MET × 3,5 × 70 / 200 = 4,29 kcal/min → 70 min
  assert.equal(walk.minutes, 70);
  assert.equal(jog.minutes, 30);
});

test('Buddy-Tipps passen zur Lage', () => {
  const base = { hour: 8, isToday: true, name: 'Sabri', eaten: { kcal: 0, protein: 0 }, burned: 0, target, water: 0, mealsLogged: 0, streak: 0, weight: 80 };
  assert.match(I.buddyTips(base)[0].text, /Guten Morgen, Sabri/);
  const over = I.buddyTips({ ...base, hour: 20, eaten: { kcal: 2400, protein: 130 }, mealsLogged: 4, water: 3000 });
  assert.match(over[0].text, /Spaziergang von \d+ Minuten/);
  assert.ok(I.buddyTips({ ...base, isToday: false }).length >= 6);
});

test('„Passt noch rein“ bleibt im Budget', () => {
  const pool = FOODS.map((f) => ({ id: f.id, name: f.name, category: f.category, kcal: Math.round((f.kcal * (f.portion || 100)) / 100), protein: (f.protein * (f.portion || 100)) / 100, kind: 'food' }));
  const out = I.suggestFits({ remainingKcal: 300, proteinGap: 40, meal: 'snacks', pool });
  assert.ok(out.length > 0 && out.length <= 6);
  assert.ok(out.every((p) => p.kcal <= 300));
  assert.ok(out.every((p) => !/öl|butter|zucker/i.test(p.name)));
  assert.deepEqual(I.suggestFits({ remainingKcal: 40, proteinGap: 0, meal: 'lunch', pool }), []);
});

test('Gewichtsprognose', () => {
  const weights = Array.from({ length: 8 }, (_, i) => ({ date: `2026-09-${String(1 + i * 3).padStart(2, '0')}`, kg: 90 - i * 0.3 }));
  const f = I.weightForecast(weights, 85, '2026-09-22');
  assert.equal(f.perWeek, -0.7);
  assert.ok(f.date > '2026-10-01' && f.date < '2026-12-01', f.date);
  assert.equal(I.weightForecast(weights, 95, '2026-09-22').date, null);
  assert.equal(I.weightForecast(weights.slice(0, 2), 85, '2026-09-22'), null);
});

test('Abzeichen und Serien', () => {
  assert.equal(I.longestStreak(['2026-09-03', '2026-09-01', '2026-09-02', '2026-09-05']), 3);
  const got = I.earnedBadges({ entries: 3, photoMeals: 5, bestStreak: 7, waterDays: 0, proteinDays: 1, onTargetDays: 0, dishes: 1, workouts: 0, veggies: 0, bestScore: 50, longestFastH: 16.5, moodDays: 0 });
  assert.deepEqual([...got].sort(), ['fast16', 'first', 'photo', 'protein', 'streak3', 'streak7']);
});

test('Stimmung und Fasten', () => {
  const rows = [{ mood: 5, onTarget: true }, { mood: 4, onTarget: true }, { mood: 2, onTarget: false }, { mood: 3, onTarget: false }, { onTarget: true }];
  assert.deepEqual(I.moodInsight(rows), { onTarget: 4.5, other: 2.5, diff: 2 });
  assert.equal(I.moodInsight(rows.slice(0, 3)), null);
  assert.equal(I.fastingPhase(16, 16).emoji, '🏆');
  assert.equal(I.fastingPhase(1, 16).emoji, '🍽️');
});

test('Jedes Lebensmittel bekommt ein Emoji', () => {
  assert.equal(foodEmoji('Vollmilchschokolade'), '🍫');
  assert.equal(foodEmoji('Reis (gekocht)'), '🍚');
  assert.equal(foodEmoji('Ei (Größe M)'), '🥚');
  assert.equal(foodEmoji('Vanilleeis'), '🍦');
  assert.equal(foodEmoji('Eisbergsalat'), '🥬');
  assert.equal(foodEmoji('Butterkeks'), '🍪');
  assert.equal(foodEmoji('Schweineschnitzel'), '🥩');
  assert.equal(foodEmoji('Irgendwas', 'Obst'), '🍎');
  const fallback = FOODS.filter((f) => foodEmoji(f.name, f.category) === '🍽️');
  assert.deepEqual(fallback.map((f) => f.name), []);
});
