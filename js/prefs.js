// Vorlieben: was man gern isst und was man nicht isst (ohne DOM, getestet).
// Begriffe wie „Pilze“ oder „Laktose“ werden zu passenden Zutaten erweitert.

const GROUPS = {
  pilz: ['pilz', 'champignon', 'pfifferling', 'steinpilz', 'shiitake'],
  fisch: ['fisch', 'lachs', 'thunfisch', 'kabeljau', 'seelachs', 'forelle', 'hering', 'makrele', 'sardine', 'alaska', 'dorsch', 'pangasius'],
  meeresfrücht: ['garnele', 'shrimp', 'krabbe', 'muschel', 'tintenfisch', 'calamar', 'scampi'],
  schwein: ['schwein', 'speck', 'schinken', 'salami', 'bacon', 'mett', 'kassler', 'bratwurst', 'leberwurst', 'chorizo', 'gyros'],
  rind: ['rind', 'beef', 'steak', 'hack'],
  fleisch: ['fleisch', 'hähnchen', 'huhn', 'pute', 'rind', 'schwein', 'hack', 'wurst', 'schinken', 'speck', 'salami', 'steak', 'lamm', 'kebab', 'döner', 'frikadelle', 'schnitzel'],
  nuss: ['nuss', 'nüsse', 'mandel', 'cashew', 'erdnuss', 'walnuss', 'haselnuss', 'pistazie', 'macadamia', 'pekan', 'nougat'],
  laktos: ['milch', 'käse', 'joghurt', 'quark', 'sahne', 'butter', 'skyr', 'frischkäse', 'mozzarella', 'feta', 'parmesan', 'gouda', 'schmand', 'kefir'],
  milchprodukt: ['milch', 'käse', 'joghurt', 'quark', 'sahne', 'butter', 'skyr', 'frischkäse', 'mozzarella', 'feta', 'parmesan', 'gouda', 'schmand', 'kefir'],
  gluten: ['weizen', 'nudel', 'spaghetti', 'pasta', 'brot', 'brötchen', 'toast', 'mehl', 'couscous', 'bulgur', 'gerste', 'roggen', 'dinkel', 'wrap', 'tortilla', 'pizza', 'paniert', 'semmel'],
  ei: ['ei', 'eier', 'eiklar', 'rührei', 'spiegelei', 'omelett'],
  zwiebel: ['zwiebel', 'lauch', 'schalotte', 'frühlingszwiebel'],
  scharf: ['chili', 'scharf', 'jalapeño', 'peperoni', 'sriracha', 'harissa'],
  soja: ['soja', 'tofu', 'tempeh', 'edamame'],
  alkohol: ['bier', 'wein', 'alkohol', 'likör', 'rum'],
};

const ALIASES = { ei: ['eier'], nuss: ['nüss'], laktos: ['milchprodukt'], meeresfrücht: ['meeresfrücht'], schwein: ['schweine'], gluten: ['weizen'] };

/** Begriff vereinheitlichen und grob auf den Wortstamm kürzen. */
export function normalizeTerm(term) {
  return String(term || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(keinen|keine|kein|ohne)\s+/, '')
    .slice(0, 40);
}

function stem(word) {
  return word.replace(/(innen|en|er|n|e|s)$/u, '').replace(/frei$/, '');
}

/** Liste von Wörtern, nach denen für einen Begriff gesucht wird. */
export function expandTerm(term) {
  const t = normalizeTerm(term);
  if (!t) return [];
  const s = t.length <= 4 ? t : stem(t);
  // Nur Oberbegriffe („Pilze“, „Laktose“, „Fleisch“) werden erweitert, einzelne Lebensmittel nicht
  for (const [key, words] of Object.entries(GROUPS)) {
    const hit = (key.length <= 2 ? s === key : s.startsWith(key)) || (key.startsWith(s) && s.length >= 4) || (ALIASES[key] || []).some((a) => s.startsWith(a));
    if (hit) return [...new Set([s, ...words])];
  }
  return [s.length >= 3 ? s : t];
}

const WORD_EDGE = /[^a-zäöüß]/;

/** Kommt das Suchwort im Text vor? Kurze Wörter (z. B. „ei“) nur als ganzes Wort. */
function containsWord(text, w) {
  if (w.length > 3) return text.includes(w);
  return text.split(WORD_EDGE).some((part) => part === w || part === `${w}er`);
}

/** Welche Begriffe aus `terms` treffen auf die Texte zu? */
export function findMatches(texts, terms) {
  const text = texts.filter(Boolean).join(' | ').toLowerCase();
  if (/laktosefrei/.test(text)) {
    // „laktosefreie Milch“ verstößt nicht gegen „Laktose“
    terms = terms.filter((t) => !/laktos/.test(normalizeTerm(t)));
  }
  return terms.filter((t) => expandTerm(t).some((w) => containsWord(text, w)));
}

/** Konflikte eines Plan-Gerichts mit den „esse ich nicht“-Begriffen. */
export function mealConflicts(meal, dislikes) {
  if (!dislikes?.length) return [];
  const texts = [meal.name, ...(meal.ingredients || []).flatMap((i) => [i.name, i.buy])];
  return findMatches(texts, dislikes);
}

/** Text für KI-Prompts. */
export function prefsPrompt(prefs) {
  const likes = prefs?.likes || [];
  const dislikes = prefs?.dislikes || [];
  let out = '';
  if (likes.length) out += ` Isst gern: ${likes.join(', ')} – baue das öfter ein.`;
  if (dislikes.length) out += ` Isst NICHT (strikt vermeiden, auch nicht als Zutat, Soße oder Beilage): ${dislikes.join(', ')}.`;
  return out;
}

/** Eingabe wie „Pilze, Fisch und Nüsse“ in einzelne Begriffe zerlegen. */
export function splitInput(text) {
  return String(text || '')
    .split(/,|;|\n|\bund\b|\+/i)
    .map((t) => t.trim().replace(/^[-•]\s*/, ''))
    .filter((t) => t.length >= 2)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .slice(0, 20);
}
