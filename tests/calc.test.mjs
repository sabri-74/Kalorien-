import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../js/calc.js';
import { FOODS } from '../js/foods.js';
import { EXERCISES, CARDIO, PLANS } from '../js/exercises.js';

const man = { sex: 'male', age: 30, height: 180, weight: 80, activity: 'moderate', goal: 'maintain' };
const woman = { sex: 'female', age: 30, height: 165, weight: 60, activity: 'sedentary', goal: 'lose_fast' };

test('Grundumsatz nach Mifflin-St Jeor', () => {
  assert.equal(c.bmr(man), 1780); // 800 + 1125 - 150 + 5
  assert.equal(c.bmr(woman), 1320); // 600 + 1031.25 - 150 - 161 = 1320.25
});

test('Gesamtumsatz und Kalorienziel', () => {
  assert.equal(c.tdee(man), 2759);
  assert.equal(c.calorieTarget(man), 2759);
  assert.equal(c.calorieTarget({ ...man, goal: 'lose' }), 2259);
  // 1320 × 1,2 − 750 = 834 → Untergrenze 1200
  assert.equal(c.calorieTarget(woman), 1200);
});

test('Makros ergeben ungefähr das Kalorienziel', () => {
  const kcal = 2200;
  const m = c.macroTargets(kcal, 80, 'lose');
  assert.equal(m.protein, 160);
  const total = m.protein * 4 + m.carbs * 4 + m.fat * 9;
  assert.ok(Math.abs(total - kcal) < 10, `Summe ${total}`);
});

test('BMI und Kategorie', () => {
  assert.equal(c.bmi(80, 180), 24.7);
  assert.equal(c.bmiCategory(24.7).label, 'Normalgewicht');
  assert.equal(c.bmiCategory(31).level, 'bad');
});

test('MET-Kalorien', () => {
  // Joggen 8 MET, 70 kg, 30 min → 8·3,5·70/200·30 = 294
  assert.equal(c.metCalories(8, 70, 30), 294);
});

test('Lebensmittel skalieren und summieren', () => {
  const oats = { kcal: 372, protein: 13.5, carbs: 58.7, fat: 7 };
  const s = c.scaleFood(oats, 50);
  assert.deepEqual(s, { kcal: 186, protein: 6.8, carbs: 29.4, fat: 3.5 });
  const sum = c.sumNutrients([s, s]);
  assert.equal(sum.kcal, 372);
  assert.equal(sum.protein, 13.6);
});

test('1RM und Volumen', () => {
  assert.equal(c.oneRepMax(100, 1), 100);
  assert.equal(c.oneRepMax(100, 10), 133.3);
  assert.equal(c.volume([{ reps: 10, weight: 60 }, { reps: 8, weight: 70 }]), 1160);
});

test('Datumshilfen und Serie', () => {
  assert.equal(c.addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(c.addDays('2026-01-01', -1), '2025-12-31');
  assert.deepEqual(c.lastDays('2026-03-02', 3), ['2026-02-28', '2026-03-01', '2026-03-02']);
  const days = new Set(['2026-03-01', '2026-02-28', '2026-02-26']);
  assert.equal(c.streak((k) => days.has(k), '2026-03-02'), 2);
  assert.equal(c.streak((k) => days.has(k), '2026-03-01'), 2);
});

test('Gleitender Durchschnitt', () => {
  assert.deepEqual(c.movingAverage([80, 82, 81], 2), [80, 81, 81.5]);
});

test('Datenbanken sind vollständig', () => {
  assert.ok(FOODS.length >= 100);
  for (const f of FOODS) {
    for (const k of ['kcal', 'protein', 'carbs', 'fat']) assert.equal(typeof f[k], 'number', `${f.name}.${k}`);
    // Energie aus Makros sollte grob zu kcal passen (Alkohol/Ballaststoffe ausgenommen)
    const est = f.protein * 4 + f.carbs * 4 + f.fat * 9;
    if (!f.alcohol) assert.ok(Math.abs(est - f.kcal) <= Math.max(40, f.kcal * 0.25), `${f.name}: ${est} vs ${f.kcal}`);
  }
  const ids = new Set(EXERCISES.map((e) => e.id));
  for (const p of PLANS) for (const d of p.days) for (const id of d.exercises) assert.ok(ids.has(id), `${p.name}: ${id}`);
  assert.ok(CARDIO.every((a) => a.met > 0));
});

test('Basis skalieren: Gramm und Portionen', () => {
  const base = { kcal: 200, protein: 10, carbs: 20, fat: 5 };
  assert.deepEqual(c.scaleBase(base, 50, 'g'), { kcal: 100, protein: 5, carbs: 10, fat: 2.5 });
  assert.deepEqual(c.scaleBase(base, 1.5, 'portion'), { kcal: 300, protein: 15, carbs: 30, fat: 7.5 });
});

test('Gericht: Summe und Portion', () => {
  const dish = {
    servings: 2,
    ingredients: [
      { amount: 200, kcal: 300, protein: 10, carbs: 60, fat: 2 },
      { amount: 100, kcal: 101, protein: 20, carbs: 0, fat: 1.5 },
    ],
  };
  const t = c.dishTotals(dish);
  assert.equal(t.total.kcal, 401);
  assert.equal(t.grams, 300);
  assert.deepEqual(t.perServing, { kcal: 201, protein: 15, carbs: 30, fat: 1.8 });
  assert.equal(c.dishTotals({ servings: 0, ingredients: [] }).perServing.kcal, 0);
});

test('Mahlzeit nach Uhrzeit', () => {
  assert.equal(c.mealForHour(7), 'breakfast');
  assert.equal(c.mealForHour(12), 'lunch');
  assert.equal(c.mealForHour(19), 'dinner');
  assert.equal(c.mealForHour(16), 'snacks');
  assert.equal(c.mealForHour(23), 'snacks');
});

test('KI-Antwort wird bereinigt', () => {
  const r = c.normalizeAiResult({
    title: 'Spaghetti',
    items: [
      { name: 'Spaghetti', grams: 200, kcal: 300, protein: '10,5', carbs: 60, fat: 2, confidence: 'hoch' },
      { name: '', grams: 50, kcal: 10 },
      { name: 'Soße', grams: 0, kcal: 80 },
      { name: 'Parmesan', grams: 10, kcal: 43, protein: 3.8, carbs: 0, fat: 2.9, confidence: 'egal' },
    ],
  });
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.items[0].base, { kcal: 150, protein: 5.3, carbs: 30, fat: 1 });
  assert.equal(r.items[1].confidence, 'mittel');
  assert.equal(c.normalizeAiResult(null).items.length, 0);
});
