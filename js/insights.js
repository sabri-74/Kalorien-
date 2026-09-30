// Auswertungen ohne DOM: Tages-Score, Buddy-Tipps, „Passt noch rein“,
// Verbrenn-Rechner, Gewichtsprognose, Abzeichen und Stimmungs-Auswertung.

import * as C from './calc.js';

const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

// ---------- Tages-Score ----------

/** Score 0–100 aus Kalorien, Eiweiß, Wasser, Bewegung und Einträgen. */
export function dayScore({ eaten, burned, target, water, mealsLogged }) {
  const budget = target.kcal + burned;
  const ratio = eaten.kcal / Math.max(1, budget);
  let kcalPts = 0;
  if (eaten.kcal > 0) {
    const diff = ratio < 0.9 ? (0.9 - ratio) / 0.6 : ratio > 1.05 ? (ratio - 1.05) / 0.35 : 0;
    kcalPts = 40 * (1 - Math.min(1, diff));
  }
  const parts = [
    { key: 'kcal', emoji: '🎯', label: 'Kalorien im Ziel', pts: kcalPts, max: 40 },
    { key: 'protein', emoji: '💪', label: 'Eiweiß', pts: 20 * Math.min(1, eaten.protein / Math.max(1, target.protein)), max: 20 },
    { key: 'water', emoji: '💧', label: 'Wasser', pts: 15 * Math.min(1, water / Math.max(1, target.water)), max: 15 },
    { key: 'move', emoji: '🔥', label: 'Bewegung', pts: 15 * Math.min(1, burned / 250), max: 15 },
    { key: 'log', emoji: '📝', label: 'Mahlzeiten eingetragen', pts: 10 * Math.min(1, mealsLogged / 3), max: 10 },
  ].map((p) => ({ ...p, pts: Math.round(p.pts) }));
  const total = Math.min(100, parts.reduce((s, p) => s + p.pts, 0));
  return { total, parts, ...scoreGrade(total) };
}

export function scoreGrade(total) {
  if (total >= 85) return { emoji: '🤩', grade: 'Überragend' };
  if (total >= 70) return { emoji: '😄', grade: 'Richtig gut' };
  if (total >= 50) return { emoji: '🙂', grade: 'Auf gutem Weg' };
  if (total >= 25) return { emoji: '😐', grade: 'Da geht noch was' };
  return { emoji: '🌱', grade: 'Der Tag beginnt' };
}

// ---------- Verbrenn-Rechner ----------

const BURN = [
  { emoji: '🚶', label: 'Gehen', met: 3.5 },
  { emoji: '🚴', label: 'Radfahren', met: 6.8 },
  { emoji: '🏃', label: 'Joggen', met: 8.3 },
  { emoji: '🏊', label: 'Schwimmen', met: 7 },
];

/** Wie viele Minuten Bewegung entsprechen `kcal`? */
export function burnEquivalents(kcal, weight) {
  return BURN.map((b) => ({ ...b, minutes: Math.max(1, Math.round(kcal / ((b.met * 3.5 * weight) / 200))) }));
}

// ---------- Buddy-Tipps ----------

const GENERAL = [
  { mood: '🥗', text: 'Gemüse zuerst essen macht schneller satt – der Magen meldet sich früher.' },
  { mood: '⏳', text: 'Iss langsam: Das Sättigungsgefühl kommt erst nach etwa 20 Minuten.' },
  { mood: '😴', text: 'Wenig Schlaf macht Heißhunger. 7–9 Stunden sind ideal.' },
  { mood: '⚖️', text: 'Wieg dich morgens nach dem Aufstehen – dann sind die Werte vergleichbar.' },
  { mood: '📸', text: 'Tipp: Fotografier dein Essen von schräg oben mit Besteck im Bild, dann schätzt die KI genauer.' },
  { mood: '🍲', text: 'Kochst du etwas öfter? Speicher es als Gericht, dann reicht beim nächsten Mal ein Tipp.' },
];

/**
 * Passende Tipps für den Tag, wichtigste zuerst.
 * ctx: { hour, isToday, name, eaten, burned, target, water, mealsLogged, streak, weight }
 */
export function buddyTips(ctx) {
  const { hour, isToday, eaten, burned, target, water, mealsLogged, streak, weight } = ctx;
  const hi = ctx.name ? `, ${ctx.name}` : '';
  const budget = target.kcal + burned;
  const remaining = budget - eaten.kcal;
  const tips = [];
  if (isToday) {
    if (!mealsLogged && hour < 11) tips.push({ mood: '☀️', text: `Guten Morgen${hi}! Ein Frühstück mit Eiweiß – z. B. Skyr mit Beeren – hält lange satt.` });
    else if (!mealsLogged) tips.push({ mood: '📸', text: `Noch nichts eingetragen${hi}. Fotografier einfach dein nächstes Essen, ich rechne für dich.` });
    if (remaining < -50) {
      const walk = burnEquivalents(-remaining, weight)[0].minutes;
      tips.push({ mood: '🤗', text: `Heute ist es etwas mehr geworden – kein Drama! Ein Spaziergang von ${walk} Minuten gleicht es aus.` });
    } else if (mealsLogged >= 3 && remaining >= 0 && remaining < 150) {
      tips.push({ mood: '🎯', text: 'Punktlandung! Du bist fast genau im Ziel. Stark gemacht!' });
    }
    const proteinGap = target.protein - eaten.protein;
    if (hour >= 14 && proteinGap > 30) tips.push({ mood: '💪', text: `Dir fehlen noch ${Math.round(proteinGap)} g Eiweiß. Magerquark, Hähnchen oder Linsen helfen.` });
    if (hour >= 13 && water < target.water * 0.5) tips.push({ mood: '💧', text: `Schon getrunken? Du bist bei ${round(water / 1000, 1).toLocaleString('de-DE')} von ${round(target.water / 1000, 1).toLocaleString('de-DE')} Litern.` });
    if (water >= target.water) tips.push({ mood: '🌊', text: 'Wasserziel geschafft – dein Körper sagt Danke!' });
    if (hour >= 16 && !burned) tips.push({ mood: '🚴', text: `Lust auf Bewegung? 20 Minuten Radfahren schenken dir rund ${Math.round((6.8 * 3.5 * weight) / 200 * 20)} kcal Spielraum.` });
    if (streak >= 3) tips.push({ mood: '🔥', text: `${streak} Tage am Stück eingetragen! Bleib dran, Gewohnheiten entstehen genau so.` });
  }
  const start = (ctx.seed ?? 0) % GENERAL.length;
  return [...tips, ...GENERAL.slice(start), ...GENERAL.slice(0, start)];
}

// ---------- „Passt noch rein“ ----------

const MEAL_CATS = {
  breakfast: ['Getreide', 'Milch & Ei', 'Obst'],
  lunch: ['Fleisch & Fisch', 'Gerichte', 'Hülsenfrüchte', 'Gemüse', 'Getreide'],
  dinner: ['Fleisch & Fisch', 'Gerichte', 'Hülsenfrüchte', 'Gemüse'],
  snacks: ['Obst', 'Milch & Ei', 'Nüsse & Fette', 'Süßes & Snacks'],
};
const NOT_ALONE = /öl|butter|zucker|sahne|honig|marmelade|ketchup|mayonnaise|senf|pesto|roh\)|pulver/i;

/**
 * Vorschläge, die in das Restbudget passen.
 * pool: [{ id, name, category, kcal, protein, amount, unit, kind: 'food'|'dish' }]
 */
export function suggestFits({ remainingKcal, proteinGap, meal, pool, limit = 6 }) {
  if (remainingKcal < 60) return [];
  const aim = Math.min(remainingKcal, meal === 'snacks' ? 250 : 550);
  const cats = MEAL_CATS[meal] || [];
  const scored = pool
    .filter((p) => p.kcal > 20 && p.kcal <= remainingKcal && p.category !== 'Saucen' && p.category !== 'Getränke' && !NOT_ALONE.test(p.name))
    .map((p) => {
      let score = 1 - Math.abs(p.kcal - aim) / aim;
      if (proteinGap > 15) score += Math.min(0.8, (p.protein / Math.max(1, p.kcal)) * 100 * 0.07);
      if (cats.includes(p.category)) score += 0.35;
      if (p.kind === 'dish') score += 0.4;
      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score);
  const perCat = {};
  const out = [];
  for (const p of scored) {
    const c = p.kind === 'dish' ? 'dish' : p.category;
    perCat[c] = (perCat[c] || 0) + 1;
    if (perCat[c] > 2) continue;
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

// ---------- Gewichtsprognose ----------

/**
 * Lineare Regression über die Messungen der letzten 30 Tage.
 * Liefert { perWeek, date } – date ist null, wenn das Ziel nicht in Sicht ist.
 */
export function weightForecast(weights, targetKg, todayKey) {
  const from = C.addDays(todayKey, -30);
  const pts = weights.filter((w) => w.date >= from);
  if (pts.length < 3) return null;
  const t0 = C.parseKey(pts[0].date).getTime();
  const xs = pts.map((w) => (C.parseKey(w.date).getTime() - t0) / 864e5);
  if (xs[xs.length - 1] < 6) return null;
  const ys = pts.map((w) => w.kg);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx;
  const todayX = (C.parseKey(todayKey).getTime() - t0) / 864e5;
  const now = my + slope * (todayX - mx);
  const res = { perWeek: round(slope * 7, 2), now: round(now, 1), date: null, days: null };
  if (!targetKg || Math.abs(slope) < 0.005) return res;
  const days = (targetKg - now) / slope;
  if (days <= 0 || days > 730) return res;
  res.days = Math.round(days);
  res.date = C.addDays(todayKey, res.days);
  return res;
}

// ---------- Abzeichen ----------

export const BADGES = [
  { id: 'first', emoji: '🍽️', title: 'Erster Bissen', desc: 'Den ersten Eintrag gemacht' },
  { id: 'photo', emoji: '📸', title: 'Foto-Profi', desc: '5 Mahlzeiten per Foto erkannt' },
  { id: 'streak3', emoji: '🔥', title: 'Warmgelaufen', desc: '3 Tage in Folge eingetragen' },
  { id: 'streak7', emoji: '🚀', title: 'Eine Woche dabei', desc: '7 Tage in Folge eingetragen' },
  { id: 'streak30', emoji: '👑', title: 'Gewohnheit', desc: '30 Tage in Folge eingetragen' },
  { id: 'water', emoji: '💧', title: 'Hydro-Held', desc: 'Wasserziel an einem Tag erreicht' },
  { id: 'protein', emoji: '💪', title: 'Eiweiß-Champion', desc: 'Eiweißziel an einem Tag erreicht' },
  { id: 'ontarget', emoji: '🎯', title: 'Punktlandung', desc: '3+ Mahlzeiten und im Kalorienziel' },
  { id: 'chef', emoji: '👩‍🍳', title: 'Koch-Talent', desc: '3 eigene Gerichte gespeichert' },
  { id: 'sport5', emoji: '🏋️', title: 'Sportskanone', desc: '5 Trainings eingetragen' },
  { id: 'veggie', emoji: '🥦', title: 'Grünzeug-Fan', desc: '15× Obst oder Gemüse gegessen' },
  { id: 'score90', emoji: '🌟', title: 'Traumtag', desc: 'Tages-Score von 90 oder mehr' },
  { id: 'fast16', emoji: '⏱️', title: 'Fasten-Profi', desc: '16 Stunden gefastet' },
  { id: 'mood', emoji: '😊', title: 'Achtsam', desc: '5× die Stimmung eingetragen' },
];

/**
 * Welche Abzeichen sind verdient? summary kommt aus collectSummary().
 */
export function earnedBadges(s) {
  const got = new Set();
  if (s.entries > 0) got.add('first');
  if (s.photoMeals >= 5) got.add('photo');
  if (s.bestStreak >= 3) got.add('streak3');
  if (s.bestStreak >= 7) got.add('streak7');
  if (s.bestStreak >= 30) got.add('streak30');
  if (s.waterDays > 0) got.add('water');
  if (s.proteinDays > 0) got.add('protein');
  if (s.onTargetDays > 0) got.add('ontarget');
  if (s.dishes >= 3) got.add('chef');
  if (s.workouts >= 5) got.add('sport5');
  if (s.veggies >= 15) got.add('veggie');
  if (s.bestScore >= 90) got.add('score90');
  if (s.longestFastH >= 16) got.add('fast16');
  if (s.moodDays >= 5) got.add('mood');
  return got;
}

/** Längste Serie aufeinanderfolgender Tage in einer sortierten Liste von Datums-Schlüsseln. */
export function longestStreak(keys) {
  const sorted = [...new Set(keys)].sort();
  let best = 0;
  let cur = 0;
  let prev = null;
  for (const k of sorted) {
    cur = prev && C.addDays(prev, 1) === k ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = k;
  }
  return best;
}

// ---------- Stimmung ----------

/** Vergleicht die Stimmung an Tagen im Kalorienziel mit den übrigen Tagen. */
export function moodInsight(rows) {
  const withMood = rows.filter((r) => r.mood);
  const good = withMood.filter((r) => r.onTarget);
  const other = withMood.filter((r) => !r.onTarget);
  if (good.length < 2 || other.length < 2) return null;
  const avg = (a) => round(a.reduce((s, r) => s + r.mood, 0) / a.length, 1);
  return { onTarget: avg(good), other: avg(other), diff: round(avg(good) - avg(other), 1) };
}

// ---------- Fasten ----------

export function fastingPhase(hours, goalH = 16) {
  if (hours >= goalH) return { emoji: '🏆', text: 'Fastenziel erreicht' };
  const f = hours / goalH;
  if (f < 0.25) return { emoji: '🍽️', text: 'Verdauung läuft' };
  if (f < 0.6) return { emoji: '😌', text: 'Körper kommt zur Ruhe' };
  if (f < 0.85) return { emoji: '🔋', text: 'Energiereserven werden genutzt' };
  return { emoji: '🔥', text: 'Fast geschafft' };
}
