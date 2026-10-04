import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, defaultState } from '../js/store.js';

test('Einträge aus Version 1 werden übernommen', () => {
  const old = {
    profile: { sex: 'male', age: 30, height: 180, weight: 80, activity: 'moderate', goal: 'lose' },
    settings: { theme: 'dark' },
    days: {
      '2026-09-01': {
        meals: {
          breakfast: [{ id: 'a', name: 'Haferflocken', amount: 50, per100: { kcal: 372, protein: 13.5, carbs: 58.7, fat: 7 }, kcal: 186, protein: 6.8, carbs: 29.4, fat: 3.5 }],
          lunch: [{ id: 'b', name: 'Alt ohne Basis', amount: 200, kcal: 300, protein: 10, carbs: 40, fat: 10 }],
        },
        water: 500,
        workouts: [],
      },
    },
    weights: [{ date: '2026-09-02', kg: 79 }, { date: '2026-09-01', kg: 80 }, null],
  };
  const s = migrate(old);
  const [oats] = s.days['2026-09-01'].meals.breakfast;
  assert.equal(oats.unit, 'g');
  assert.deepEqual(oats.base, { kcal: 372, protein: 13.5, carbs: 58.7, fat: 7 });
  assert.equal(oats.per100, undefined);
  const [legacy] = s.days['2026-09-01'].meals.lunch;
  assert.equal(legacy.base.kcal, 150);
  assert.deepEqual(s.days['2026-09-01'].meals.snacks, []);
  assert.deepEqual(s.dishes, []);
  assert.equal(s.settings.theme, 'dark');
  assert.equal(s.settings.apiKey, '');
  assert.deepEqual(s.weights.map((w) => w.kg), [80, 79]);
});

test('Leerer Zustand ist gültig', () => {
  const s = migrate(defaultState());
  assert.equal(s.version, 2);
  assert.deepEqual(s.days, {});
});

test('beschädigte Daten führen nie zum Absturz und behalten Gültiges', () => {
  const bad = [
    null, [], { days: null }, { settings: null, fasting: null, prefs: { likes: null } },
    { days: { '2026-10-01': null, '2026-10-02': { meals: { lunch: [null, 'x', { name: 'Apfel', amount: 100, base: { kcal: 52, protein: 0, carbs: 14, fat: 0 } }], dinner: 'kaputt' }, workouts: 'x' } } },
    { mealPlan: { days: null }, activeWorkout: { name: 'x' }, weights: [null, 5, { date: '2026-10-01', kg: 80 }] },
  ];
  for (const d of bad) {
    const s = migrate(d);
    assert.ok(Array.isArray(s.prefs.likes));
    for (const day of Object.values(s.days)) {
      for (const list of Object.values(day.meals)) assert.ok(Array.isArray(list));
      assert.ok(Array.isArray(day.workouts));
    }
  }
  const s = migrate(bad[4]);
  assert.deepEqual(Object.keys(s.days), ['2026-10-02']);
  assert.equal(s.days['2026-10-02'].meals.lunch.length, 1);
  assert.equal(migrate(bad[5]).mealPlan, null);
  assert.equal(migrate(bad[5]).activeWorkout, null);
  assert.equal(migrate(bad[5]).weights.length, 1);
});
