// Emojis für Lebensmittel, Mahlzeiten und Aktivitäten.
// Reihenfolge der Regeln ist wichtig: spezifische Wörter zuerst
// (z. B. „Vollmilchschokolade“ → Schokolade, nicht Milch).

const RULES = [
  ['eisberg', '🥬'], ['kichererbse', '🫘'], ['süßkartoffel', '🍠'], ['kartoffelchips', '🥔'], ['chips', '🥔'],
  ['erdnussbutter', '🥜'], ['erdnüsse', '🥜'], ['erdnuss', '🥜'], ['keks', '🍪'], ['kuchen', '🍰'], ['torte', '🎂'],
  ['strudel', '🥧'], ['schorle', '🧃'], ['saft', '🧃'], ['riegel', '🍫'], ['schokolade', '🍫'], ['nougat', '🍫'],
  ['reiswaffel', '🍘'], ['knäcke', '🍘'], ['haferflocken', '🥣'], ['porridge', '🥣'], ['müsli', '🥣'], ['granola', '🥣'],
  ['cornflakes', '🥣'], ['brezel', '🥨'], ['croissant', '🥐'], ['brötchen', '🥯'], ['toast', '🍞'], ['brot', '🍞'],
  ['wrap', '🌯'], ['döner', '🥙'], ['kebab', '🥙'], ['falafel', '🧆'], ['hummus', '🧆'], ['pizza', '🍕'], ['pommes', '🍟'],
  ['burger', '🍔'], ['sandwich', '🥪'], ['taco', '🌮'], ['sushi', '🍣'], ['pfannkuchen', '🥞'], ['waffel', '🧇'],
  ['kartoffel', '🥔'], ['bolognese', '🍝'], ['spaghetti', '🍝'], ['nudel', '🍝'], ['pasta', '🍝'], ['lasagne', '🍝'],
  ['curry', '🍛'], ['dal', '🍛'], ['suppe', '🍲'], ['eintopf', '🍲'], ['reis', '🍚'], ['couscous', '🍚'], ['quinoa', '🍚'],
  ['brokkoli', '🥦'], ['blumenkohl', '🥦'], ['karotte', '🥕'], ['möhre', '🥕'], ['gurke', '🥒'], ['zucchini', '🥒'],
  ['tomate', '🍅'], ['ketchup', '🍅'], ['paprika', '🫑'], ['spinat', '🥬'], ['salat', '🥗'], ['bowl', '🥗'],
  ['champignon', '🍄'], ['pilz', '🍄'], ['zwiebel', '🧅'], ['knoblauch', '🧄'], ['erbse', '🫛'], ['mais', '🌽'],
  ['bohne', '🫘'], ['linse', '🫘'], ['tofu', '🍱'], ['avocado', '🥑'], ['apfel', '🍎'], ['banane', '🍌'],
  ['orange', '🍊'], ['mandarine', '🍊'], ['birne', '🍐'], ['erdbeer', '🍓'], ['marmelade', '🍓'], ['heidelbeer', '🫐'],
  ['beere', '🫐'], ['traube', '🍇'], ['rosine', '🍇'], ['kiwi', '🥝'], ['mango', '🥭'], ['ananas', '🍍'], ['melone', '🍉'],
  ['dattel', '🌴'], ['hüttenkäse', '🧀'], ['frischkäse', '🧀'], ['käse', '🧀'], ['gouda', '🧀'], ['emmentaler', '🧀'],
  ['mozzarella', '🧀'], ['feta', '🧀'], ['parmesan', '🧀'], ['butter', '🧈'], ['quark', '🥛'], ['skyr', '🥛'],
  ['joghurt', '🥛'], ['milch', '🥛'], ['sahne', '🥛'], ['hähnchen', '🍗'], ['huhn', '🍗'], ['pute', '🍗'], ['chicken', '🍗'],
  ['hack', '🥩'], ['steak', '🥩'], ['rind', '🥩'], ['schwein', '🥩'], ['schnitzel', '🥩'], ['würstchen', '🌭'],
  ['wurst', '🌭'], ['salami', '🍖'], ['schinken', '🍖'], ['aufschnitt', '🍖'], ['lachs', '🐟'], ['thunfisch', '🐟'],
  ['kabeljau', '🐟'], ['fisch', '🐟'], ['garnele', '🦐'], ['mandel', '🌰'], ['walnu', '🌰'], ['cashew', '🌰'],
  ['nuss', '🌰'], ['nüsse', '🌰'], ['öl', '🫒'], ['chia', '🌱'], ['leinsamen', '🌱'], ['gummi', '🍬'], ['zucker', '🍬'],
  ['honig', '🍯'], ['kaffee', '☕'], ['cappuccino', '☕'], ['latte', '☕'], ['espresso', '☕'], ['tee', '🍵'],
  ['cola', '🥤'], ['limo', '🥤'], ['shake', '🥤'], ['whey', '🥤'], ['protein', '💪'], ['bier', '🍺'], ['wein', '🍷'],
  ['wasser', '💧'], ['mayo', '🥚'], ['senf', '🌭'], ['pesto', '🌿'], ['sauce', '🥫'], ['soße', '🥫'], ['obst', '🍎'],
  ['gemüse', '🥦'], ['frühstück', '🍳'], ['snack', '🍿'],
];

const CATEGORY = {
  Getreide: '🌾', Gemüse: '🥦', Hülsenfrüchte: '🫘', Obst: '🍎', 'Milch & Ei': '🥛', 'Fleisch & Fisch': '🍗',
  'Nüsse & Fette': '🌰', 'Süßes & Snacks': '🍬', Getränke: '🥤', Saucen: '🥫', Gerichte: '🍽️', Eigene: '⭐',
};

export function foodEmoji(name, category) {
  const n = String(name || '').toLowerCase();
  // Einzelwörter, die sonst in anderen Wörtern stecken (Reis, Eiweiß …)
  if (/(^|[^a-zäöüß])(ei|eier|eiklar|spiegelei|rührei)([^a-zäöüß]|$)/.test(n)) return '🥚';
  if (/(^|[^a-zäöüß])(eis|vanilleeis|eiscreme)([^a-zäöüß]|$)|vanilleeis/.test(n)) return '🍦';
  for (const [k, e] of RULES) if (n.includes(k)) return e;
  return CATEGORY[category] || '🍽️';
}

export const MEAL_META = {
  breakfast: { emoji: '🌅', hue: 'breakfast' },
  lunch: { emoji: '🥗', hue: 'lunch' },
  dinner: { emoji: '🌙', hue: 'dinner' },
  snacks: { emoji: '🍿', hue: 'snacks' },
};

export const CARDIO_EMOJI = {
  walk: '🚶', 'walk-fast': '🚶‍♀️', jog: '🏃', run: '🏃‍♂️', 'run-fast': '⚡', bike: '🚲', 'bike-fast': '🚴', ergometer: '🚴',
  swim: '🏊', rowing: '🚣', crosstrainer: '🏃‍♀️', hiit: '🔥', rope: '🪢', stairs: '🪜', hike: '🥾', football: '⚽',
  basketball: '🏀', tennis: '🎾', boxing: '🥊', dance: '💃', yoga: '🧘', pilates: '🤸',
};

export const MUSCLE_EMOJI = { Brust: '🏋️', Rücken: '🦅', Beine: '🦵', Schultern: '🤷', Arme: '💪', Core: '🎯' };

export const MOODS = [
  { v: 1, emoji: '😫', label: 'Schlapp' },
  { v: 2, emoji: '😕', label: 'Mäßig' },
  { v: 3, emoji: '😐', label: 'Okay' },
  { v: 4, emoji: '🙂', label: 'Gut' },
  { v: 5, emoji: '🤩', label: 'Top' },
];
