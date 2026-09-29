// Reine Rechenfunktionen – ohne DOM, damit sie mit `node --test` prüfbar sind.

export const ACTIVITY_LEVELS = {
  sedentary: { factor: 1.2, label: 'Sitzend (kaum Bewegung)' },
  light: { factor: 1.375, label: 'Leicht aktiv (1–3× Sport/Woche)' },
  moderate: { factor: 1.55, label: 'Mäßig aktiv (3–5× Sport/Woche)' },
  active: { factor: 1.725, label: 'Sehr aktiv (6–7× Sport/Woche)' },
  athlete: { factor: 1.9, label: 'Extrem aktiv (körperliche Arbeit + Sport)' },
};

export const GOALS = {
  lose_fast: { delta: -750, label: 'Schnell abnehmen (≈ −0,75 kg/Woche)' },
  lose: { delta: -500, label: 'Abnehmen (≈ −0,5 kg/Woche)' },
  maintain: { delta: 0, label: 'Gewicht halten' },
  gain: { delta: 300, label: 'Muskelaufbau (≈ +0,25 kg/Woche)' },
};

const round = (n, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/** Grundumsatz nach Mifflin-St Jeor (kcal/Tag). */
export function bmr({ sex, weight, height, age }) {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return round(sex === 'female' ? base - 161 : base + 5);
}

/** Gesamtumsatz = Grundumsatz × Aktivitätsfaktor. */
export function tdee(profile) {
  const level = ACTIVITY_LEVELS[profile.activity] ?? ACTIVITY_LEVELS.moderate;
  return round(bmr(profile) * level.factor);
}

/** Tägliches Kalorienziel, nie unter einer sicheren Untergrenze. */
export function calorieTarget(profile) {
  const goal = GOALS[profile.goal] ?? GOALS.maintain;
  const floor = profile.sex === 'female' ? 1200 : 1500;
  return Math.max(floor, round(tdee(profile) + goal.delta));
}

/**
 * Makroziele in Gramm. Protein nach Körpergewicht, Fett 25–30 % der Energie,
 * Kohlenhydrate füllen den Rest.
 */
export function macroTargets(kcal, weight, goal = 'maintain') {
  const proteinPerKg = { lose_fast: 2.2, lose: 2.0, maintain: 1.6, gain: 1.8 }[goal] ?? 1.6;
  const protein = round(weight * proteinPerKg);
  const fat = round((kcal * (goal === 'gain' ? 0.25 : 0.28)) / 9);
  const carbs = Math.max(0, round((kcal - protein * 4 - fat * 9) / 4));
  return { protein, carbs, fat };
}

/** Wasserziel in ml (≈ 35 ml pro kg, auf 250 ml gerundet). */
export function waterTarget(weight) {
  return Math.round((weight * 35) / 250) * 250;
}

export function bmi(weight, heightCm) {
  const m = heightCm / 100;
  return round(weight / (m * m), 1);
}

export function bmiCategory(value) {
  if (value < 18.5) return { label: 'Untergewicht', level: 'warn' };
  if (value < 25) return { label: 'Normalgewicht', level: 'good' };
  if (value < 30) return { label: 'Übergewicht', level: 'warn' };
  return { label: 'Adipositas', level: 'bad' };
}

/** Verbrauchte kcal aus MET-Wert: MET × 3,5 × kg / 200 × Minuten. */
export function metCalories(met, weight, minutes) {
  return round((met * 3.5 * weight * minutes) / 200);
}

/** Nährwerte eines Lebensmittels (Angaben pro 100 g/ml) für eine Menge. */
export function scaleFood(food, amount) {
  const k = amount / 100;
  return {
    kcal: round(food.kcal * k),
    protein: round(food.protein * k, 1),
    carbs: round(food.carbs * k, 1),
    fat: round(food.fat * k, 1),
  };
}

export function sumNutrients(entries) {
  const t = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + (e.kcal || 0),
      protein: acc.protein + (e.protein || 0),
      carbs: acc.carbs + (e.carbs || 0),
      fat: acc.fat + (e.fat || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return { kcal: round(t.kcal), protein: round(t.protein, 1), carbs: round(t.carbs, 1), fat: round(t.fat, 1) };
}

/** Geschätztes 1-Wiederholungsmaximum nach Epley. */
export function oneRepMax(weight, reps) {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return round(weight * (1 + reps / 30), 1);
}

/** Trainingsvolumen = Σ Wdh × Gewicht. */
export function volume(sets) {
  return round(sets.reduce((s, x) => s + (x.reps || 0) * (x.weight || 0), 0));
}

// ---------- Datumshilfen (lokale Zeit, Schlüssel YYYY-MM-DD) ----------

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** Liste der letzten n Tage bis einschließlich `endKey`, älteste zuerst. */
export function lastDays(endKey, n) {
  return Array.from({ length: n }, (_, i) => addDays(endKey, i - n + 1));
}

/** Aufeinanderfolgende Tage mit Einträgen, rückwärts ab `todayKey`. */
export function streak(hasEntry, todayKey) {
  let key = hasEntry(todayKey) ? todayKey : addDays(todayKey, -1);
  let n = 0;
  while (hasEntry(key)) {
    n++;
    key = addDays(key, -1);
  }
  return n;
}

/** Gleitender Durchschnitt über `window` Werte (für Gewichtstrend). */
export function movingAverage(values, window = 7) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return round(slice.reduce((a, b) => a + b, 0) / slice.length, 1);
  });
}

// ---------- Gerichte, Einträge, KI ----------

/** Nährwerte aus einer Basis (pro 100 g bzw. pro 1 Portion) für eine Menge. */
export function scaleBase(base, amount, unit = 'g') {
  const k = unit === 'portion' ? amount : amount / 100;
  return {
    kcal: round((base.kcal || 0) * k),
    protein: round((base.protein || 0) * k, 1),
    carbs: round((base.carbs || 0) * k, 1),
    fat: round((base.fat || 0) * k, 1),
  };
}

/** Summe und Werte pro Portion eines Gerichts aus seinen Zutaten. */
export function dishTotals(dish) {
  const total = sumNutrients(dish.ingredients || []);
  const servings = Math.max(1, Number(dish.servings) || 1);
  const grams = (dish.ingredients || []).reduce((s, i) => s + (i.unit === 'portion' ? 0 : Number(i.amount) || 0), 0);
  return {
    total,
    grams: round(grams),
    perServing: {
      kcal: round(total.kcal / servings),
      protein: round(total.protein / servings, 1),
      carbs: round(total.carbs / servings, 1),
      fat: round(total.fat / servings, 1),
    },
  };
}

/** Passende Mahlzeit zur Uhrzeit. */
export function mealForHour(hour) {
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 17 && hour < 22) return 'dinner';
  return 'snacks';
}

export function greeting(hour) {
  if (hour < 5) return 'Gute Nacht';
  if (hour < 11) return 'Guten Morgen';
  if (hour < 18) return 'Hallo';
  return 'Guten Abend';
}

const clampNum = (v, min, max) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0;
};

/**
 * Bereinigt eine KI-Antwort: nur sinnvolle Zahlen, Basis pro 100 g
 * berechnet, damit sich die Menge später frei ändern lässt.
 */
export function normalizeAiResult(raw) {
  const items = (Array.isArray(raw?.items) ? raw.items : [])
    .map((it) => {
      const grams = clampNum(it.grams, 0, 3000);
      const kcal = clampNum(it.kcal, 0, 10000);
      const protein = clampNum(it.protein, 0, 500);
      const carbs = clampNum(it.carbs, 0, 1000);
      const fat = clampNum(it.fat, 0, 500);
      const name = String(it.name || '').trim().slice(0, 80);
      if (!name || !grams) return null;
      const f = 100 / grams;
      return {
        name,
        amount: round(grams),
        confidence: ['hoch', 'mittel', 'niedrig'].includes(it.confidence) ? it.confidence : 'mittel',
        base: { kcal: round(kcal * f, 1), protein: round(protein * f, 1), carbs: round(carbs * f, 1), fat: round(fat * f, 1) },
      };
    })
    .filter(Boolean);
  return {
    title: String(raw?.title || '').trim().slice(0, 80) || (items[0]?.name ?? 'Mahlzeit'),
    note: String(raw?.note || '').trim().slice(0, 300),
    items,
  };
}
