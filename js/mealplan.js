// Essensplan & Einkaufsliste: Bereinigung der KI-Antwort und Hilfsfunktionen (ohne DOM).

export const STORES = {
  any: { label: 'Egal – am günstigsten', emoji: '💸', domain: null },
  lidl: { label: 'Lidl', emoji: '🟡', domain: 'lidl.de' },
  aldi: { label: 'Aldi', emoji: '🔵', domain: 'aldi-sued.de' },
  kaufland: { label: 'Kaufland', emoji: '🔴', domain: 'kaufland.de' },
  netto: { label: 'Netto', emoji: '🟨', domain: 'netto-online.de' },
  penny: { label: 'Penny', emoji: '🟥', domain: 'penny.de' },
  rewe: { label: 'REWE', emoji: '🟥', domain: 'rewe.de' },
  edeka: { label: 'Edeka', emoji: '🟦', domain: 'edeka.de' },
};

export const SECTIONS = [
  { id: 'obst', label: 'Obst & Gemüse', emoji: '🥬' },
  { id: 'fleisch', label: 'Fleisch & Fisch', emoji: '🥩' },
  { id: 'kuehl', label: 'Kühlregal & Milch', emoji: '🥛' },
  { id: 'brot', label: 'Brot & Backwaren', emoji: '🍞' },
  { id: 'vorrat', label: 'Vorrat & Konserven', emoji: '🥫' },
  { id: 'tk', label: 'Tiefkühl', emoji: '🧊' },
  { id: 'sonst', label: 'Sonstiges', emoji: '🛍️' },
];

export const DIETS = {
  all: 'Alles',
  vegetarian: 'Vegetarisch',
  vegan: 'Vegan',
  nopork: 'Ohne Schwein',
  lactosefree: 'Laktosefrei',
};

export const SLOTS = { breakfast: 'Frühstück', lunch: 'Mittagessen', dinner: 'Abendessen', snacks: 'Snack' };

const num = (v, max) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n * 100) / 100)) : 0;
};
const str = (v, len) => String(v ?? '').trim().slice(0, len);
const storeId = (v) => {
  const s = String(v || '').toLowerCase();
  return Object.keys(STORES).find((k) => k !== 'any' && s.includes(k)) || 'any';
};
const sectionId = (v) => (SECTIONS.some((s) => s.id === v) ? v : 'sonst');

/** Bereinigt die KI-Antwort für einen Essensplan. */
export function normalizeMealPlan(raw) {
  const days = (Array.isArray(raw?.days) ? raw.days : []).slice(0, 7).map((d, di) => ({
    title: str(d?.title, 40) || `Tag ${di + 1}`,
    meals: (Array.isArray(d?.meals) ? d.meals : [])
      .map((m) => ({
        slot: SLOTS[m?.slot] ? m.slot : 'lunch',
        emoji: str(m?.emoji, 8) || '🍽️',
        name: str(m?.name, 80),
        minutes: num(m?.minutes, 240),
        kcal: num(m?.kcal, 3000),
        protein: num(m?.protein, 300),
        carbs: num(m?.carbs, 500),
        fat: num(m?.fat, 300),
        price: num(m?.price, 50),
        ingredients: (Array.isArray(m?.ingredients) ? m.ingredients : []).map((i) => ({ name: str(i?.name, 60), amount: str(i?.amount, 30) })).filter((i) => i.name),
        steps: (Array.isArray(m?.steps) ? m.steps : []).map((x) => str(x, 240)).filter(Boolean).slice(0, 8),
      }))
      .filter((m) => m.name && m.kcal > 0),
  })).filter((d) => d.meals.length);
  const shopping = (Array.isArray(raw?.shopping) ? raw.shopping : [])
    .map((i) => ({
      name: str(i?.name, 60),
      amount: str(i?.amount, 30),
      section: sectionId(i?.section),
      store: storeId(i?.store),
      price: num(i?.price, 100),
    }))
    .filter((i) => i.name);
  return { days, shopping, tip: str(raw?.tip, 300) };
}

/** Summe der Nährwerte und Kosten eines Plantags. */
export function dayPlanTotals(day) {
  return day.meals.reduce(
    (a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat, price: a.price + m.price }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, price: 0 },
  );
}

/** Einkaufsliste nach Regal gruppieren (Reihenfolge wie im Laden). */
export function groupShopping(items) {
  return SECTIONS.map((s) => ({ ...s, items: items.filter((i) => i.section === s.id) })).filter((g) => g.items.length);
}

export function shoppingTotal(items, onlyOpen = false) {
  return Math.round(items.filter((i) => !onlyOpen || !i.done).reduce((a, i) => a + (i.price || 0), 0) * 100) / 100;
}

/** Ordnet einen frei eingetippten Artikel grob einem Regal zu. */
export function guessSection(name) {
  const n = name.toLowerCase();
  if (/apfel|banane|tomate|gurke|salat|paprika|zwiebel|möhre|karotte|kartoffel|beere|obst|gemüse|spinat|brokkoli|zitrone|avocado|pilz|champignon/.test(n)) return 'obst';
  if (/hähnchen|pute|rind|hack|schwein|lachs|fisch|thunfisch|wurst|schinken|garnele/.test(n)) return 'fleisch';
  if (/milch|joghurt|quark|skyr|käse|butter|sahne|(^|\s)eier?(\s|$)|feta|mozzarella|tofu/.test(n)) return 'kuehl';
  if (/brot|brötchen|toast|wrap|tortilla/.test(n)) return 'brot';
  if (/tk|tiefkühl|gefroren/.test(n)) return 'tk';
  if (/reis|nudel|haferflocken|linsen|bohnen|mehl|öl|dose|konserve|müsli|nüsse|gewürz|salz|zucker|kichererbse/.test(n)) return 'vorrat';
  return 'sonst';
}

/** Teilbarer Text der Einkaufsliste. */
export function shoppingText(items) {
  const lines = ['🛒 Einkaufsliste'];
  for (const g of groupShopping(items.filter((i) => !i.done))) {
    lines.push('', `${g.emoji} ${g.label}`);
    for (const i of g.items) lines.push(`• ${i.name}${i.amount ? ` (${i.amount})` : ''}${i.price ? ` – ca. ${i.price.toFixed(2).replace('.', ',')} €` : ''}`);
  }
  return lines.join('\n');
}

/** Link: Produkt beim Markt suchen (über eine Websuche auf der Händlerseite). */
export function productSearchUrl(name, store) {
  const domain = STORES[store]?.domain;
  const q = domain ? `${name} site:${domain}` : `${name} Angebot Discounter`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/** Link: Markt in der Nähe in Google Maps. */
export function storeMapUrl(store) {
  const label = store && store !== 'any' ? STORES[store].label : 'Supermarkt';
  return `https://www.google.com/maps/search/${encodeURIComponent(`${label} in der Nähe`)}`;
}
