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
    settings: { theme: 'system', palette: 'sunset', customKcal: null, apiKey: '' },
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
    prefs: { likes: [], dislikes: [] }, // Vorlieben
  };
}

export function emptyDay() {
  return { meals: { breakfast: [], lunch: [], dinner: [], snacks: [] }, water: 0, workouts: [] };
}

export function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
  } catch {
    // Nie stillschweigend überschreiben: kaputte Daten vorher wegsichern
    try {
      if (raw) localStorage.setItem(`${KEY}.backup-${Date.now()}`, raw);
    } catch {
      /* Speicher voll – dann bleibt nur der Neustart */
    }
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

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v) => (Array.isArray(v) ? v : []);

/** Einträge aus Version 1 (per100) auf das neue Format (base + unit) heben. */
function migrateEntry(e) {
  if (e.base) return { unit: 'g', ...e };
  const base = e.per100 ||
    (e.amount ? { kcal: (e.kcal / e.amount) * 100, protein: (e.protein / e.amount) * 100, carbs: (e.carbs / e.amount) * 100, fat: (e.fat / e.amount) * 100 } : { kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat });
  const { per100, ...rest } = e;
  return { ...rest, unit: e.amount ? 'g' : 'portion', amount: e.amount || 1, base };
}

/** Füllt fehlende Felder auf, damit ältere, importierte oder beschädigte Daten funktionieren. */
export function migrate(input) {
  const data = isObj(input) ? input : {};
  const base = defaultState();
  const state = {
    ...base,
    ...data,
    settings: { ...base.settings, ...(isObj(data.settings) ? data.settings : {}) },
    fasting: { ...base.fasting, ...(isObj(data.fasting) ? data.fasting : {}) },
    version: 2,
  };
  if (!isObj(state.profile)) state.profile = null;
  state.badges = arr(state.badges);
  const prefs = isObj(data.prefs) ? data.prefs : {};
  state.prefs = { likes: arr(prefs.likes).filter((x) => typeof x === 'string'), dislikes: arr(prefs.dislikes).filter((x) => typeof x === 'string') };
  for (const key of ['customFoods', 'recentFoods', 'favorites', 'dishes', 'weights', 'shopping']) {
    state[key] = arr(state[key]).filter(isObj);
  }
  if (!isObj(state.mealPlan) || !Array.isArray(state.mealPlan.days)) state.mealPlan = null;
  if (!isObj(state.activeWorkout) || !Array.isArray(state.activeWorkout.exercises)) state.activeWorkout = null;
  const days = isObj(data.days) ? data.days : {};
  state.days = {};
  for (const key of Object.keys(days)) {
    const d = days[key];
    if (!isObj(d) || !/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const meals = emptyDay().meals;
    for (const m of Object.keys(meals)) meals[m] = arr(d.meals?.[m]).filter(isObj).map(migrateEntry);
    state.days[key] = { ...emptyDay(), ...d, meals, water: Number(d.water) || 0, workouts: arr(d.workouts).filter(isObj) };
  }
  state.weights = state.weights.filter((w) => w.date && w.kg).sort((a, b) => String(a.date).localeCompare(String(b.date)));
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
