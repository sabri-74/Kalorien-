import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mealPlanDayPrompt, aiErrorText, AiError } from '../js/ai.js';

test('Tagesplan-Prompt enthält alle Vorgaben', () => {
  const p = mealPlanDayPrompt({ index: 1, days: 3, store: 'lidl', storeLabel: 'Lidl', budget: 9, dietLabel: 'Vegetarisch', wish: 'viel Eiweiß', targets: { kcal: 1931, protein: 170, carbs: 178, fat: 60 } });
  assert.match(p, /Tag 2 von 3/);
  assert.match(p, /1931 kcal/);
  assert.match(p, /170 g Eiweiß/);
  assert.match(p, /bei Lidl/);
  assert.match(p, /Vegetarisch/);
  assert.match(p, /9\.00 €/);
  assert.match(p, /viel Eiweiß/);
  assert.ok(p.length < 2500, `Prompt zu lang: ${p.length}`);
});

test('Fehlertexte nennen den Code', () => {
  const e = new AiError('upstream');
  e.raw = 'upstream_error';
  assert.match(aiErrorText(e), /abgebrochen.*Code: upstream_error/);
  assert.match(aiErrorText(new AiError('session')), /neu an/);
});
