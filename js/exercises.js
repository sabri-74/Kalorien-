// Übungsbibliothek, Ausdauer-Aktivitäten (MET-Werte nach Compendium of Physical
// Activities) und fertige Trainingspläne.

export const MUSCLES = ['Brust', 'Rücken', 'Beine', 'Schultern', 'Arme', 'Core'];

export const EXERCISES = [
  { id: 'bench', name: 'Bankdrücken', muscle: 'Brust', tip: 'Schulterblätter zusammen, Füße fest am Boden.' },
  { id: 'incline-db', name: 'Schrägbankdrücken (KH)', muscle: 'Brust', tip: 'Bank auf 30°, kontrolliert absenken.' },
  { id: 'pushup', name: 'Liegestütze', muscle: 'Brust', tip: 'Körper bleibt eine Linie, Ellbogen ~45°.' },
  { id: 'dips', name: 'Dips', muscle: 'Brust', tip: 'Leicht nach vorn lehnen für mehr Brust.' },
  { id: 'fly', name: 'Butterfly', muscle: 'Brust', tip: 'Arme leicht gebeugt, langsam zurück.' },
  { id: 'deadlift', name: 'Kreuzheben', muscle: 'Rücken', tip: 'Rücken neutral, Stange nah am Körper.' },
  { id: 'pullup', name: 'Klimmzüge', muscle: 'Rücken', tip: 'Volle Streckung unten, Brust zur Stange.' },
  { id: 'row', name: 'Langhantelrudern', muscle: 'Rücken', tip: 'Oberkörper ~45°, zum Bauchnabel ziehen.' },
  { id: 'latpull', name: 'Latziehen', muscle: 'Rücken', tip: 'Zur oberen Brust ziehen, nicht schwingen.' },
  { id: 'cablerow', name: 'Rudern am Kabel', muscle: 'Rücken', tip: 'Schulterblätter aktiv zurückziehen.' },
  { id: 'squat', name: 'Kniebeuge', muscle: 'Beine', tip: 'Knie folgen den Zehen, mind. parallel.' },
  { id: 'legpress', name: 'Beinpresse', muscle: 'Beine', tip: 'Knie nicht ganz durchstrecken.' },
  { id: 'rdl', name: 'Rumänisches Kreuzheben', muscle: 'Beine', tip: 'Hüfte nach hinten, Beinbeuger dehnen.' },
  { id: 'lunge', name: 'Ausfallschritte', muscle: 'Beine', tip: 'Hinteres Knie Richtung Boden.' },
  { id: 'legcurl', name: 'Beinbeuger', muscle: 'Beine', tip: 'Langsam in der exzentrischen Phase.' },
  { id: 'calf', name: 'Wadenheben', muscle: 'Beine', tip: 'Oben kurz halten, voller Bewegungsumfang.' },
  { id: 'hipthrust', name: 'Hip Thrust', muscle: 'Beine', tip: 'Oben Gesäß fest anspannen.' },
  { id: 'ohp', name: 'Schulterdrücken', muscle: 'Schultern', tip: 'Core fest, kein Hohlkreuz.' },
  { id: 'lateral', name: 'Seitheben', muscle: 'Schultern', tip: 'Bis Schulterhöhe, Daumen leicht nach unten.' },
  { id: 'facepull', name: 'Face Pulls', muscle: 'Schultern', tip: 'Seil Richtung Stirn, Ellbogen hoch.' },
  { id: 'curl', name: 'Bizepscurls', muscle: 'Arme', tip: 'Ellbogen bleiben am Körper.' },
  { id: 'hammer', name: 'Hammercurls', muscle: 'Arme', tip: 'Neutraler Griff, kontrolliert.' },
  { id: 'triceps', name: 'Trizepsdrücken am Kabel', muscle: 'Arme', tip: 'Nur Unterarme bewegen.' },
  { id: 'skull', name: 'French Press', muscle: 'Arme', tip: 'Ellbogen zeigen zur Decke.' },
  { id: 'plank', name: 'Unterarmstütz (Sek.)', muscle: 'Core', tip: 'Wdh = Sekunden. Po nicht hochschieben.' },
  { id: 'crunch', name: 'Crunches', muscle: 'Core', tip: 'Lendenwirbel bleiben am Boden.' },
  { id: 'legraise', name: 'Beinheben hängend', muscle: 'Core', tip: 'Ohne Schwung, Becken einrollen.' },
  { id: 'russian', name: 'Russian Twist', muscle: 'Core', tip: 'Rotation aus dem Oberkörper.' },
];

export const CARDIO = [
  { id: 'walk', name: 'Spazieren (5 km/h)', met: 3.5 },
  { id: 'walk-fast', name: 'Zügiges Gehen (6,5 km/h)', met: 5 },
  { id: 'jog', name: 'Joggen (8 km/h)', met: 8.3 },
  { id: 'run', name: 'Laufen (10 km/h)', met: 9.8 },
  { id: 'run-fast', name: 'Laufen (12 km/h)', met: 11.8 },
  { id: 'bike', name: 'Radfahren (gemütlich)', met: 4 },
  { id: 'bike-fast', name: 'Radfahren (zügig, 20–25 km/h)', met: 8 },
  { id: 'ergometer', name: 'Ergometer (mittel)', met: 6.8 },
  { id: 'swim', name: 'Schwimmen (mittel)', met: 7 },
  { id: 'rowing', name: 'Rudergerät (mittel)', met: 7 },
  { id: 'crosstrainer', name: 'Crosstrainer', met: 5 },
  { id: 'hiit', name: 'HIIT / Zirkeltraining', met: 8 },
  { id: 'rope', name: 'Seilspringen', met: 11 },
  { id: 'stairs', name: 'Treppensteigen', met: 8.8 },
  { id: 'hike', name: 'Wandern', met: 6 },
  { id: 'football', name: 'Fußball', met: 7 },
  { id: 'basketball', name: 'Basketball', met: 6.5 },
  { id: 'tennis', name: 'Tennis', met: 7.3 },
  { id: 'boxing', name: 'Boxen (Sandsack)', met: 5.5 },
  { id: 'dance', name: 'Tanzen', met: 5 },
  { id: 'yoga', name: 'Yoga', met: 2.5 },
  { id: 'pilates', name: 'Pilates', met: 3 },
];

/** MET-Wert für Krafttraining (allgemein, mittlere Intensität). */
export const STRENGTH_MET = 5;

export const PLANS = [
  {
    id: 'fullbody',
    name: 'Ganzkörper 3×/Woche',
    level: 'Einsteiger',
    scheme: '3 Sätze × 8–12 Wdh',
    days: [
      { name: 'Tag A', exercises: ['squat', 'bench', 'row', 'ohp', 'plank'] },
      { name: 'Tag B', exercises: ['deadlift', 'incline-db', 'latpull', 'lunge', 'crunch'] },
    ],
  },
  {
    id: 'ppl',
    name: 'Push / Pull / Beine',
    level: 'Fortgeschritten',
    scheme: '4 Sätze × 6–10 Wdh',
    days: [
      { name: 'Push', exercises: ['bench', 'ohp', 'incline-db', 'lateral', 'triceps'] },
      { name: 'Pull', exercises: ['deadlift', 'pullup', 'row', 'facepull', 'curl'] },
      { name: 'Beine', exercises: ['squat', 'rdl', 'legpress', 'legcurl', 'calf'] },
    ],
  },
  {
    id: 'upperlower',
    name: 'Oberkörper / Unterkörper',
    level: 'Mittel',
    scheme: '3–4 Sätze × 8–12 Wdh',
    days: [
      { name: 'Oberkörper', exercises: ['bench', 'row', 'ohp', 'latpull', 'curl', 'triceps'] },
      { name: 'Unterkörper', exercises: ['squat', 'rdl', 'lunge', 'hipthrust', 'calf', 'legraise'] },
    ],
  },
  {
    id: 'home',
    name: 'Zuhause ohne Geräte',
    level: 'Einsteiger',
    scheme: '3 Runden × 12–20 Wdh',
    days: [{ name: 'Zirkel', exercises: ['pushup', 'squat', 'lunge', 'plank', 'crunch', 'russian'] }],
  },
];

export const exerciseById = (id) => EXERCISES.find((e) => e.id === id);
