// Speicherung im Browser (localStorage). Alle Daten bleiben auf dem Gerät.
// Fotos liegen separat in IndexedDB (siehe photos.js).

const KEY = 'kalorien.v1';

export const MEALS = [
  { id: 'breakfast', label: 'Frühstück' },
  { id: 'lunch', label: 'Mittagessen' },
  { id: 'dinner', label: 'Abendessen' },
  { id: 'snacks', label: 'Snacks' },
];

export function defaultState() {
  return {
    version: 2,
    profile: null, // { name, sex, age, height, weight, activity, goal, targetWeight }
    settings: { theme: 'system', customKcal: null, apiKey: '' },
    customFoods: [],
    recentFoods: [], // Lebensmittel-Objekte, neueste zuerst
    favorites: [], // Lebensmittel-Objekte
    dishes: [], // eigene Gerichte
    days: {}, // { 'YYYY-MM-DD': { meals: {...}, water, workouts } }
    weights: [], // [{ date, kg }]
    activeWorkout: null,
    fasting: { start: null, goalH: 16, last: null, longestH: 0 },
    badges: [], // bereits gefeierte Abzeichen
    mealPlan: null, // KI-Essensplan
    shopping: [], // Einkaufsliste
  };
}

export function emptyDay() {
  return { meals: { breakfast: [], lunch: [], dinner: [], snacks: [] }, water: 0, workouts: [] };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Einträge aus Version 1 (per100) auf das neue Format (base + unit) heben. */
function migrateEntry(e) {
  if (e.base) return { unit: 'g', ...e };
  const base = e.per100 ||
    (e.amount ? { kcal: (e.kcal / e.amount) * 100, protein: (e.protein / e.amount) * 100, carbs: (e.carbs / e.amount) * 100, fat: (e.fat / e.amount) * 100 } : { kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat });
  const { per100, ...rest } = e;
  return { ...rest, unit: e.amount ? 'g' : 'portion', amount: e.amount || 1, base };
}

/** Füllt fehlende Felder auf, damit ältere oder importierte Daten funktionieren. */
export function migrate(data) {
  const base = defaultState();
  const state = { ...base, ...data, settings: { ...base.settings, ...(data.settings || {}) }, fasting: { ...base.fasting, ...(data.fasting || {}) }, version: 2 };
  if (!Array.isArray(state.badges)) state.badges = [];
  for (const key of ['customFoods', 'recentFoods', 'favorites', 'dishes', 'weights', 'shopping']) {
    if (!Array.isArray(state[key])) state[key] = [];
  }
  for (const key of Object.keys(state.days || {})) {
    const d = state.days[key];
    const meals = { ...emptyDay().meals, ...(d.meals || {}) };
    for (const m of Object.keys(meals)) meals[m] = (meals[m] || []).map(migrateEntry);
    state.days[key] = { ...emptyDay(), ...d, meals, workouts: d.workouts || [] };
  }
  state.weights = state.weights.filter((w) => w && w.date && w.kg).sort((a, b) => a.date.localeCompare(b.date));
  return state;
}

export function getDay(state, key) {
  if (!state.days[key]) state.days[key] = emptyDay();
  return state.days[key];
}

/** Nur lesen, ohne leere Tage anzulegen. */
export function peekDay(state, key) {
  return state.days[key] || emptyDay();
}

export function dayEntries(day) {
  return MEALS.flatMap((m) => day.meals[m.id] || []);
}

export function hasActivity(state, key) {
  const d = state.days[key];
  return !!d && (dayEntries(d).length > 0 || d.workouts.length > 0);
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
