import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../js/game.js';

const target = { kcal: 2000, protein: 120, water: 2500 };
const entry = (name, kcal, protein, source) => ({ name, kcal, protein, carbs: 0, fat: 0, source });
const goodDay = {
  meals: { breakfast: [entry('Haferflocken', 500, 30)], lunch: [entry('Hähnchen', 800, 60, 'ai')], dinner: [entry('Quark', 600, 40)], snacks: [] },
  water: 2600, workouts: [{ kcal: 200 }], mood: 4,
};

test('Tageskennzahlen und XP', () => {
  const s = G.daySummary(goodDay, target);
  assert.equal(s.meals, 3);
  assert.ok(s.waterGoal && s.proteinGoal && s.onTarget);
  // 30 Mahlzeiten + 20 Wasser + 20 Eiweiß + 30 Ziel + 25 Training + 5 Stimmung + 5 KI + 5 eingetragen
  assert.equal(G.dayXp(s), 140);
  assert.equal(G.dayXp(G.daySummary(undefined, target)), 0);
});

test('Level aus XP', () => {
  assert.equal(G.xpForLevel(1), 0);
  assert.equal(G.xpForLevel(2), 100);
  assert.equal(G.xpForLevel(3), 300);
  const l = G.levelFromXp(350);
  assert.equal(l.level, 3);
  assert.equal(l.title, 'Durchstarter');
  assert.equal(l.into, 50);
  assert.equal(l.need, 300);
  assert.equal(G.levelFromXp(0).title, 'Anfänger');
});

test('Wochen-Challenges und Gesamt-XP', () => {
  assert.equal(G.weekStart('2026-10-01'), '2026-09-28');
  const days = {};
  for (let i = 0; i < 5; i++) days[`2026-09-${28 + i > 30 ? '' : ''}${String(28 + i).padStart(2, '0')}`] = goodDay;
  const keys = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];
  const fixed = Object.fromEntries(keys.map((k) => [k, goodDay]));
  const prog = G.challengeProgress(keys.map((k) => G.daySummary(fixed[k], target)));
  const byId = Object.fromEntries(prog.map((c) => [c.id, c]));
  assert.ok(byId.water.done && byId.protein.done && byId.move.done && byId.target.done);
  assert.equal(byId.log.value, 5);
  assert.equal(byId.log.done, false);
  // 5 × 140 Tages-XP + 100 + 100 + 120 + 150 Challenges + 2 Abzeichen × 50
  assert.equal(G.totalXp(fixed, target, 2), 700 + 470 + 100);
});

test('Wochen-Rückblick', () => {
  const keys = ['2026-09-28', '2026-09-29'];
  const w = G.weekWrapped({ '2026-09-28': goodDay }, keys, target, () => '🍗');
  assert.equal(w.daysLogged, 1);
  assert.equal(w.kcal, 1900);
  assert.equal(w.avgKcal, 1900);
  assert.equal(w.waterL, 2.6);
  assert.equal(w.workouts, 1);
  assert.equal(w.topFood.times, 1);
  assert.equal(w.bestDay.key, '2026-09-28');
});
