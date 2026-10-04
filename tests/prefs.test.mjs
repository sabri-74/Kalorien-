import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../js/prefs.js';

test('Begriffe werden zu Zutaten erweitert', () => {
  assert.ok(F.expandTerm('Pilze').includes('champignon'));
  assert.ok(F.expandTerm('keinen Fisch').includes('lachs'));
  assert.ok(F.expandTerm('Laktose').includes('käse'));
  assert.ok(F.expandTerm('Nüsse').includes('mandel'));
  assert.ok(F.expandTerm('Schweinefleisch').includes('speck'));
  assert.deepEqual(F.expandTerm('Koriander'), ['koriand']);
  // Einzelne Lebensmittel bleiben einzeln: „Skyr“ verbietet nicht gleich Quark und Milch
  assert.deepEqual(F.expandTerm('Skyr'), ['skyr']);
  assert.deepEqual(F.expandTerm('Lachs'), ['lach']);
  assert.deepEqual(F.findMatches(['Magerquark 500 g'], ['Skyr']), []);
  assert.deepEqual(F.findMatches(['Rührei'], ['Eis']), []);
  assert.deepEqual(F.findMatches(['Hähnchen-Reis-Pfanne'], ['Reis', 'Hähnchen']), ['Reis', 'Hähnchen']);
  assert.deepEqual(F.findMatches(['Spiegelei auf Toast'], ['Eier']), ['Eier']);
});

test('Treffer in Gerichten', () => {
  assert.deepEqual(F.findMatches(['Hähnchen mit Champignons'], ['Pilze', 'Fisch']), ['Pilze']);
  assert.deepEqual(F.findMatches(['Lachs mit Reis'], ['Fisch']), ['Fisch']);
  assert.deepEqual(F.findMatches(['Reis mit Gemüse'], ['Ei']), []);
  assert.deepEqual(F.findMatches(['Rührei mit Toast'], ['Eier']), ['Eier']);
  assert.deepEqual(F.findMatches(['Laktosefreie Milch 1 l'], ['Laktose']), []);
  assert.deepEqual(F.findMatches(['Skyr mit Beeren'], ['Laktose']), ['Laktose']);
  assert.deepEqual(F.findMatches(['Kichererbsen-Curry'], ['Erbsen']), ['Erbsen']);
});

test('Konflikte eines Plan-Gerichts', () => {
  const meal = { name: 'Pasta Carbonara', ingredients: [{ name: 'Spaghetti', buy: 'Combino Spaghetti 500 g' }, { name: 'Speckwürfel', buy: 'Speckwürfel 125 g' }] };
  assert.deepEqual(F.mealConflicts(meal, ['Schwein', 'Gluten', 'Fisch']), ['Schwein', 'Gluten']);
  assert.deepEqual(F.mealConflicts(meal, []), []);
});

test('Eingabe zerlegen und Prompt-Text', () => {
  assert.deepEqual(F.splitInput('pilze, Fisch und nüsse; - Koriander'), ['Pilze', 'Fisch', 'Nüsse', 'Koriander']);
  const p = F.prefsPrompt({ likes: ['Hähnchen', 'Reis'], dislikes: ['Pilze'] });
  assert.match(p, /Isst gern: Hähnchen, Reis/);
  assert.match(p, /Isst NICHT .*: Pilze\./);
  assert.equal(F.prefsPrompt({ likes: [], dislikes: [] }), '');
});
