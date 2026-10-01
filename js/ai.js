// KI-Kalorienerkennung.
// In der Claude-Vorschau (Artifact) läuft sie über das Claude-Konto der
// betrachtenden Person. In der eigenständigen App wird die Claude API direkt
// aus dem Browser mit einem eigenen API-Schlüssel aufgerufen (keine
// Build-Tools, daher per fetch statt SDK).

import { normalizeAiResult } from './calc.js';

export const AI_MODEL = 'claude-opus-5-5';
const API_URL = 'https://api.anthropic.com/v1/messages';

export class AiError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

const ERROR_TEXT = {
  no_provider: 'Die KI ist noch nicht eingerichtet. Hinterleg im Profil deinen Claude-API-Schlüssel.',
  not_granted: 'Die KI-Nutzung wurde nicht erlaubt.',
  auth: 'Der API-Schlüssel wurde abgelehnt. Prüf ihn im Profil.',
  rate: 'Gerade zu viele Anfragen. Versuch es in einer Minute noch einmal.',
  overloaded: 'Die KI ist gerade ausgelastet. Versuch es gleich noch einmal.',
  network: 'Keine Verbindung zur KI. Prüf deine Internetverbindung.',
  refused: 'Die KI hat diese Anfrage abgelehnt. Formulier sie etwas anders.',
  upstream: 'Die Verbindung zur KI ist abgebrochen. Tipp auf „Nochmal versuchen“.',
  session: 'Deine Claude-Anmeldung ist abgelaufen. Bitte melde dich neu an.',
  unavailable: 'Die KI ist in dieser Ansicht nicht verfügbar.',
  images: 'Bilder können hier nicht an die KI gesendet werden. Beschreib dein Essen stattdessen.',
  toolong: 'Die Anfrage war zu groß. Wähl weniger Tage oder kürzere Wünsche.',
  invalid: 'Die Antwort der KI war unvollständig. Versuch es noch einmal.',
  credit: 'Dein API-Guthaben ist aufgebraucht. Lade es in der Claude Console auf.',
  cancelled: 'Abgebrochen.',
};

export function aiErrorText(err) {
  const text = ERROR_TEXT[err?.code] || 'Das hat nicht geklappt. Versuch es noch einmal.';
  return err?.raw ? `${text} (Code: ${err.raw})` : text;
}

// ---------- Anbieter erkennen ----------

let samplePromise;
function getSample() {
  if (!samplePromise) {
    samplePromise = window.claude?.use
      ? Promise.resolve(window.claude.use('sample')).catch(() => null)
      : Promise.resolve(null);
  }
  return samplePromise;
}

/** Welche KI steht zur Verfügung? { provider: 'claude' | 'api' | null, images } */
export async function aiStatus(apiKey) {
  const sample = await getSample();
  if (sample) {
    const limits = await sample.limits().catch(() => null);
    return { provider: 'claude', images: !!limits?.images };
  }
  if (apiKey) return { provider: 'api', images: true };
  return { provider: null, images: false };
}

// ---------- Prompts ----------

const FOOD_RULES = `Du bist eine erfahrene Ernährungsberaterin und schätzt Nährwerte von Mahlzeiten.
- Erfasse jede erkennbare Komponente als eigenen Eintrag (Hauptzutat, Beilage, Soße, Topping, Getränk).
- Schätze die Menge in Gramm realistisch anhand von Tellergröße, Besteck, Händen oder Verpackungen.
- Nutze Durchschnittswerte aus deutschen Nährwerttabellen; denk an verstecktes Fett (Bratöl, Butter, Dressing).
- kcal, protein, carbs und fat gelten für die geschätzte Grammmenge, NICHT pro 100 g.
- Namen auf Deutsch, kurz und alltagsnah (z. B. "Spaghetti, gekocht", "Tomatensoße").
- confidence ist "hoch", "mittel" oder "niedrig".
- Ist kein Essen zu erkennen, gib eine leere items-Liste zurück und erkläre es in note.

Antworte nur mit JSON in genau diesem Format:
{"title": "kurzer Name der Mahlzeit", "items": [{"name": "…", "grams": 150, "kcal": 240, "protein": 8.5, "carbs": 30, "fat": 9, "confidence": "mittel"}], "note": "ein Satz zu Unsicherheiten oder Tipps"}`;

const FOOD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'items', 'note'],
  properties: {
    title: { type: 'string' },
    note: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'confidence'],
        properties: {
          name: { type: 'string' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          confidence: { type: 'string', enum: ['hoch', 'mittel', 'niedrig'] },
        },
      },
    },
  },
};

// ---------- Aufrufe ----------

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function callApi(apiKey, content, { schema, signal, effort = 'medium' } = {}) {
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 16000,
        fallbacks: 'default',
        output_config: { effort, ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
        messages: [{ role: 'user', content }],
      }),
    });
  } catch (e) {
    throw new AiError(e?.name === 'AbortError' ? 'cancelled' : 'network');
  }
  if (!res.ok) {
    let type = '';
    try {
      type = (await res.json())?.error?.type || '';
    } catch {
      /* Fehlertext nicht lesbar */
    }
    if (res.status === 401 || res.status === 403) throw new AiError('auth');
    if (res.status === 429) throw new AiError('rate');
    if (res.status === 400 && /credit|billing/i.test(type)) throw new AiError('credit');
    if (res.status >= 500) throw new AiError('overloaded');
    throw new AiError('invalid', `HTTP ${res.status} ${type}`);
  }
  const data = await res.json();
  if (data.stop_reason === 'refusal') throw new AiError('refused');
  return (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const m = String(text).match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* weiter unten */
      }
    }
  }
  throw new AiError('invalid');
}

const SAMPLE_CODES = {
  not_granted: 'not_granted', rate_limited: 'rate', cancelled: 'cancelled', invalid_json: 'invalid', empty_completion: 'invalid',
  refused: 'refused', upstream_error: 'upstream', session_expired: 'session', sampling_disabled: 'unavailable',
  capability_disabled: 'unavailable', capability_removed: 'unavailable', not_declared: 'unavailable',
  images_unavailable: 'images', image_rejected: 'images', prompt_too_large: 'toolong',
};
function mapSampleError(e) {
  const err = new AiError(SAMPLE_CODES[e?.code] || 'upstream', e?.message);
  if (e?.code && e.code !== 'cancelled') err.raw = e.code;
  return err;
}

/**
 * Mahlzeit erkennen – aus einem Foto (Blob), einer Beschreibung oder beidem.
 * Liefert { title, note, items: [{ name, amount, confidence, base }] }.
 */
export async function analyzeMeal({ apiKey, image, text, signal }) {
  const status = await aiStatus(apiKey);
  if (!status.provider) throw new AiError('no_provider');
  const source = image
    ? `Analysiere das Foto dieser Mahlzeit.${text ? ` Zusatzinfo der Person: "${text}"` : ''}`
    : `Die Person beschreibt, was sie gegessen hat: "${text}"`;
  const prompt = `${FOOD_RULES}\n\n${source}`;

  let raw;
  if (status.provider === 'claude') {
    const sample = await getSample();
    try {
      raw = await sample.json(prompt, { images: image && status.images ? [image] : undefined, signal });
    } catch (e) {
      throw mapSampleError(e);
    }
  } else {
    const content = [];
    if (image) {
      content.push({ type: 'image', source: { type: 'base64', media_type: image.type || 'image/jpeg', data: await blobToBase64(image) } });
    }
    content.push({ type: 'text', text: prompt });
    raw = parseJson(await callApi(apiKey, content, { schema: FOOD_SCHEMA, signal }));
  }
  const result = normalizeAiResult(raw);
  if (!result.items.length && !result.note) throw new AiError('invalid');
  return result;
}

/** Kurzes Coaching-Feedback als Text. */
export async function coachFeedback({ apiKey, summary, signal, onText }) {
  const status = await aiStatus(apiKey);
  if (!status.provider) throw new AiError('no_provider');
  const prompt = `Du bist eine freundliche, sachliche Ernährungs- und Fitness-Coachin. Hier sind die Daten der letzten Tage aus einer Kalorien-App:

${summary}

Gib 3 bis 4 konkrete, motivierende Tipps auf Deutsch (Du-Form). Jeder Tipp eine Zeile, beginnend mit "• ". Beziehe dich auf die Zahlen. Insgesamt höchstens 110 Wörter, keine Überschrift, keine medizinischen Diagnosen.`;
  if (status.provider === 'claude') {
    const sample = await getSample();
    try {
      const { text } = await sample(prompt, { signal, onText: onText ? ({ text: t }) => onText(t) : undefined });
      return text;
    } catch (e) {
      throw mapSampleError(e);
    }
  }
  const text = await callApi(apiKey, [{ type: 'text', text: prompt }], { signal });
  onText?.(text);
  return text;
}

// ---------- Allgemeine JSON-Anfrage ----------

async function askJson({ apiKey, prompt, schema, image, signal, fast }) {
  const status = await aiStatus(apiKey);
  if (!status.provider) throw new AiError('no_provider');
  if (status.provider === 'claude') {
    const sample = await getSample();
    try {
      return await sample.json(prompt, { images: image && status.images ? [image] : undefined, signal, ...(fast ? { modelTier: 'quick' } : {}) });
    } catch (e) {
      throw mapSampleError(e);
    }
  }
  const content = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: image.type || 'image/jpeg', data: await blobToBase64(image) } });
  content.push({ type: 'text', text: prompt });
  return parseJson(await callApi(apiKey, content, { schema, signal, effort: fast ? 'low' : 'medium' }));
}

const num = (v, max) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n * 10) / 10)) : 0;
};
const str = (v, len) => String(v ?? '').trim().slice(0, len);

// ---------- Speisekarten-Scanner ----------

const MENU_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['picks', 'tip'],
  properties: {
    tip: { type: 'string' },
    picks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['emoji', 'name', 'kcal', 'protein', 'carbs', 'fat', 'why', 'fits'],
        properties: {
          emoji: { type: 'string' },
          name: { type: 'string' },
          kcal: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          why: { type: 'string' },
          fits: { type: 'boolean' },
        },
      },
    },
  },
};

/**
 * Empfiehlt Gerichte von einer Speisekarte passend zum Restbudget.
 * Liefert { tip, picks: [{ emoji, name, kcal, protein, carbs, fat, why, fits }] }.
 */
export async function analyzeMenu({ apiKey, image, text, budget, signal }) {
  const prompt = `Du bist eine Ernährungsberaterin und hilfst beim Bestellen im Restaurant.
Die Person hat heute noch ${Math.round(budget.kcal)} kcal übrig und braucht noch etwa ${Math.round(budget.protein)} g Eiweiß. Ihr Ziel: ${budget.goal}.
${image ? 'Auf dem Foto ist eine Speisekarte.' : ''}${text ? ` Speisekarte bzw. Auswahl: "${text}"` : ''}
Wähle die 3 bis 5 besten Gerichte von dieser Karte aus (nur Gerichte, die wirklich draufstehen). Schätze pro übliche Restaurantportion kcal, Eiweiß, Kohlenhydrate und Fett in Gramm. Sortiere die beste Wahl nach oben.
"why": ein kurzer, freundlicher Satz auf Deutsch, warum es passt, gern mit einem Bestelltipp (z. B. "Dressing extra bestellen").
"fits": true, wenn die kcal ins Restbudget passen.
"emoji": ein passendes Essens-Emoji.
"tip": ein allgemeiner Tipp für diesen Restaurantbesuch in einem Satz.
Ist keine Speisekarte zu erkennen, gib eine leere picks-Liste und erkläre es in tip.
Antworte nur mit JSON: {"tip": "…", "picks": [{"emoji": "🥗", "name": "…", "kcal": 520, "protein": 38, "carbs": 30, "fat": 22, "why": "…", "fits": true}]}`;
  const raw = await askJson({ apiKey, prompt, schema: MENU_SCHEMA, image, signal });
  const picks = (Array.isArray(raw?.picks) ? raw.picks : [])
    .map((p) => ({
      emoji: str(p.emoji, 8) || '🍽️',
      name: str(p.name, 80),
      kcal: num(p.kcal, 5000),
      protein: num(p.protein, 300),
      carbs: num(p.carbs, 600),
      fat: num(p.fat, 300),
      why: str(p.why, 200),
      fits: !!p.fits,
    }))
    .filter((p) => p.name && p.kcal > 0)
    .slice(0, 6);
  if (!picks.length && !raw?.tip) throw new AiError('invalid');
  return { tip: str(raw?.tip, 240), picks };
}

// ---------- Kühlschrank-Chef ----------

const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['emoji', 'name', 'minutes', 'servings', 'ingredients', 'steps', 'tip'],
  properties: {
    emoji: { type: 'string' },
    name: { type: 'string' },
    minutes: { type: 'number' },
    servings: { type: 'number' },
    tip: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat'],
        properties: {
          name: { type: 'string' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
        },
      },
    },
  },
};

/**
 * Schlägt aus vorhandenen Zutaten ein Rezept vor, das ins Budget passt.
 * Liefert { emoji, name, minutes, servings, ingredients: [{ name, amount, base }], steps, tip }.
 */
export async function fridgeChef({ apiKey, image, text, wish, budget, signal }) {
  const prompt = `Du bist eine kreative Köchin mit Ernährungswissen.
${image ? 'Auf dem Foto siehst du, was im Kühlschrank bzw. in der Küche vorhanden ist.' : ''}${text ? ` Vorhandene Zutaten: "${text}".` : ''}
${wish ? `Wunsch: "${wish}".` : ''}
Die Person hat heute noch ${Math.round(budget.kcal)} kcal übrig und braucht noch ${Math.round(budget.protein)} g Eiweiß. Ziel: ${budget.goal}.
Schlage EIN leckeres, einfaches Rezept für 1 Portion vor, das hauptsächlich die vorhandenen Zutaten nutzt (Grundzutaten wie Salz, Pfeffer, Gewürze, wenig Öl dürfen dazu). Eine Portion soll möglichst ins Restbudget passen und eiweißreich sein.
Gib für jede Zutat die Menge in Gramm und die Nährwerte FÜR DIESE MENGE an. 3 bis 7 kurze Kochschritte auf Deutsch. "minutes" = Zubereitungszeit. "tip" = ein Satz mit einem Profi-Tipp.
Antworte nur mit JSON: {"emoji": "🍳", "name": "…", "minutes": 15, "servings": 1, "ingredients": [{"name": "…", "grams": 100, "kcal": 150, "protein": 12, "carbs": 5, "fat": 9}], "steps": ["…"], "tip": "…"}`;
  const raw = await askJson({ apiKey, prompt, schema: RECIPE_SCHEMA, image, signal });
  const ingredients = (Array.isArray(raw?.ingredients) ? raw.ingredients : [])
    .map((i) => {
      const grams = num(i.grams, 3000);
      if (!grams || !str(i.name, 80)) return null;
      const f = 100 / grams;
      return {
        name: str(i.name, 80),
        amount: grams,
        base: { kcal: num(i.kcal, 5000) * f, protein: num(i.protein, 300) * f, carbs: num(i.carbs, 600) * f, fat: num(i.fat, 300) * f },
      };
    })
    .filter(Boolean);
  if (!ingredients.length) throw new AiError('invalid');
  return {
    emoji: str(raw.emoji, 8) || '🍳',
    name: str(raw.name, 80) || 'Kühlschrank-Rezept',
    minutes: num(raw.minutes, 240) || 15,
    servings: Math.max(1, Math.round(num(raw.servings, 12)) || 1),
    ingredients,
    steps: (Array.isArray(raw.steps) ? raw.steps : []).map((s) => str(s, 300)).filter(Boolean).slice(0, 10),
    tip: str(raw.tip, 240),
  };
}

// ---------- Essensplan: ein Tag pro Anfrage (schnell, parallel) ----------

const ING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'amount', 'buy', 'store', 'price', 'section'],
  properties: {
    name: { type: 'string' },
    amount: { type: 'string' },
    buy: { type: 'string' },
    store: { type: 'string' },
    price: { type: 'number' },
    section: { type: 'string', enum: ['obst', 'fleisch', 'kuehl', 'brot', 'vorrat', 'tk', 'sonst'] },
  },
};

const DAY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['meals', 'tip'],
  properties: {
    tip: { type: 'string' },
    meals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['slot', 'emoji', 'name', 'minutes', 'kcal', 'protein', 'carbs', 'fat', 'price', 'ingredients', 'steps'],
        properties: {
          slot: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snacks'] },
          emoji: { type: 'string' },
          name: { type: 'string' },
          minutes: { type: 'number' },
          kcal: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          price: { type: 'number' },
          ingredients: { type: 'array', items: ING_SCHEMA },
          steps: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const THEMES = ['deutsche Hausmannskost', 'mediterran', 'asiatisch', 'mexikanisch', 'orientalisch', 'italienisch', 'Bowls & Meal-Prep'];

/** Prompt für einen Plantag (exportiert für Tests). */
export function mealPlanDayPrompt(o) {
  const storeText = o.store === 'any' ? 'beim jeweils günstigsten Discounter (Aldi, Lidl, Netto, Penny, Kaufland)' : `bei ${o.storeLabel}`;
  return `Du bist Ernährungsberaterin und Spar-Expertin für deutsche Supermärkte. Plane EINEN Tag für eine Person (Tag ${o.index + 1} von ${o.days}, Küchenstil: ${THEMES[o.index % THEMES.length]}).
Tagesziel: ${Math.round(o.targets.kcal)} kcal (±5 %), mindestens ${Math.round(o.targets.protein)} g Eiweiß, ca. ${Math.round(o.targets.carbs)} g Kohlenhydrate, ${Math.round(o.targets.fat)} g Fett.
Ernährung: ${o.dietLabel}.${o.wish ? ` Wünsche: ${o.wish}.` : ''} Budget: höchstens ${o.budget.toFixed(2)} € für den Tag. Einkauf ${storeText}.
Genau 4 Mahlzeiten mit slot breakfast, lunch, dinner, snacks – einfach, max. 25 Minuten.
Je Mahlzeit: kcal, protein, carbs, fat und price (€) für die Portion; 3 bis 6 Zutaten mit amount (z. B. "80 g"), buy = konkrete günstige Packung als Eigenmarke (z. B. "Milbona Skyr 450 g"), store (Lidl, Aldi, Kaufland, Netto, Penny, REWE oder Edeka), price = Packungspreis in €, section (obst, fleisch, kuehl, brot, vorrat, tk, sonst); höchstens 3 kurze Schritte. tip = ein Spartipp in einem Satz.
Alles auf Deutsch. Antworte nur mit JSON:
{"tip":"…","meals":[{"slot":"breakfast","emoji":"🥣","name":"…","minutes":5,"kcal":520,"protein":32,"carbs":60,"fat":14,"price":0.95,"ingredients":[{"name":"Haferflocken","amount":"80 g","buy":"Golden Sun Haferflocken 500 g","store":"Lidl","price":0.69,"section":"vorrat"}],"steps":["…"]}]}`;
}

/** Plant einen Tag. Liefert die rohe KI-Antwort ({ tip, meals }). */
export async function createMealPlanDay({ apiKey, signal, ...o }) {
  return askJson({ apiKey, prompt: mealPlanDayPrompt(o), schema: DAY_SCHEMA, signal, fast: true });
}
