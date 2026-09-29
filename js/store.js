// Speicherung im Browser (localStorage). Alle Daten bleiben auf dem Gerät.

const KEY = 'kalorien.v1';

export const MEALS = [
  { id: 'breakfast', label: 'Frühstück' },
  { id: 'lunch', label: 'Mittagessen' },
  { id: 'dinner', label: 'Abendessen' },
  { id: 'snacks', label: 'Snacks' },
];

export function defaultState() {
  return {
    version: 1,
    profile: null, // { name, sex, age, height, weight, activity, goal, targetWeight }
    settings: { theme: 'system', customKcal: null },
    customFoods: [],
    recentFoods: [], // IDs, neueste zuerst
    days: {}, // { 'YYYY-MM-DD': { meals: {breakfast: [...]}, water: 0, workouts: [] } }
    weights: [], // [{ date, kg }]
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

/** Füllt fehlende Felder auf, damit ältere oder importierte Daten funktionieren. */
export function migrate(data) {
  const base = defaultState();
  const state = { ...base, ...data, settings: { ...base.settings, ...(data.settings || {}) } };
  for (const key of Object.keys(state.days || {})) {
    const d = state.days[key];
    state.days[key] = { ...emptyDay(), ...d, meals: { ...emptyDay().meals, ...(d.meals || {}) } };
  }
  state.weights = (state.weights || []).filter((w) => w && w.date && w.kg).sort((a, b) => a.date.localeCompare(b.date));
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
