import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../js/mealplan.js';

const raw = {
  tip: 'Haferflocken in der Großpackung kaufen.',
  days: [
    { title: 'Montag', meals: [
      { slot: 'breakfast', emoji: '🥣', name: 'Overnight Oats', minutes: 5, kcal: '520', protein: 30, carbs: 60, fat: 14, price: 0.9, ingredients: [{ name: 'Haferflocken', amount: '80 g' }], steps: ['Alles mischen'] },
      { slot: 'quatsch', name: 'Linsen-Curry', kcal: 680, protein: 35, carbs: 80, fat: 18, price: '1,40' },
      { slot: 'dinner', name: '', kcal: 500 },
    ] },
    { meals: [] },
  ],
  shopping: [
    { name: 'Haferflocken', amount: '500 g', section: 'vorrat', store: 'Lidl', price: 0.69 },
    { name: 'Rote Linsen', amount: '500 g', section: 'unbekannt', store: 'irgendwo', price: 1.29 },
    { name: '' },
  ],
};

test('Essensplan wird bereinigt', () => {
  const p = P.normalizeMealPlan(raw);
  assert.equal(p.days.length, 1);
  assert.equal(p.days[0].title, 'Montag');
  assert.equal(p.days[0].meals.length, 2);
  assert.equal(p.days[0].meals[1].slot, 'lunch');
  assert.equal(p.days[0].meals[1].price, 1.4);
  assert.equal(p.days[0].meals[0].kcal, 520);
  assert.deepEqual(p.shopping.map((i) => [i.store, i.section]), [['lidl', 'vorrat'], ['any', 'sonst']]);
  assert.equal(P.normalizeMealPlan(null).days.length, 0);
});

test('Summen, Gruppen und Text', () => {
  const p = P.normalizeMealPlan(raw);
  const t = P.dayPlanTotals(p.days[0]);
  assert.equal(t.kcal, 1200);
  assert.equal(Math.round(t.price * 100), 230);
  const items = p.shopping.map((i, n) => ({ ...i, done: n === 1 }));
  assert.equal(P.shoppingTotal(items), 1.98);
  assert.equal(P.shoppingTotal(items, true), 0.69);
  assert.deepEqual(P.groupShopping(items).map((g) => g.id), ['vorrat', 'sonst']);
  const text = P.shoppingText(items);
  assert.match(text, /Haferflocken \(500 g\) – ca\. 0,69 €/);
  assert.doesNotMatch(text, /Linsen/);
});

test('Regal-Schätzung und Links', () => {
  assert.equal(P.guessSection('Bananen'), 'obst');
  assert.equal(P.guessSection('Magerquark'), 'kuehl');
  assert.equal(P.guessSection('Hähnchenbrust'), 'fleisch');
  assert.equal(P.guessSection('Basmati Reis'), 'vorrat');
  assert.equal(P.guessSection('Spülmittel'), 'sonst');
  assert.match(P.productSearchUrl('Skyr', 'lidl'), /site%3Alidl\.de/);
  assert.match(P.storeMapUrl('penny'), /maps\/search\/Penny/);
  assert.match(P.storeMapUrl('any'), /Supermarkt/);
});
