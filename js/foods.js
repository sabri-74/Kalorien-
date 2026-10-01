// Lebensmittel-Datenbank. Nährwerte pro 100 g bzw. 100 ml (Durchschnittswerte,
// angelehnt an den Bundeslebensmittelschlüssel und gängige Herstellerangaben).
// Spalten: Name, Kategorie, kcal, Protein, Kohlenhydrate, Fett, Portion (g), Portionsname

const RAW = [
  // Getreide & Backwaren
  ['Haferflocken', 'Getreide', 372, 13.5, 58.7, 7, 50, 'Portion'],
  ['Vollkornbrot', 'Getreide', 219, 7.2, 38.8, 1.2, 50, 'Scheibe'],
  ['Mischbrot', 'Getreide', 227, 6.7, 45, 1.2, 45, 'Scheibe'],
  ['Brötchen (Weizen)', 'Getreide', 263, 8.6, 51, 1.8, 55, 'Stück'],
  ['Vollkornbrötchen', 'Getreide', 235, 9, 42, 2.5, 60, 'Stück'],
  ['Toastbrot', 'Getreide', 262, 8, 47, 4, 25, 'Scheibe'],
  ['Laugenbrezel', 'Getreide', 270, 8.5, 54, 1.5, 80, 'Stück'],
  ['Croissant', 'Getreide', 406, 8.2, 45.8, 21, 60, 'Stück'],
  ['Knäckebrot', 'Getreide', 350, 10, 66, 1.5, 10, 'Scheibe'],
  ['Reiswaffel', 'Getreide', 387, 8, 81, 3, 8, 'Stück'],
  ['Nudeln (gekocht)', 'Getreide', 150, 5.3, 29.5, 0.9, 200, 'Teller'],
  ['Nudeln (roh)', 'Getreide', 353, 12.5, 70, 1.5, 100, 'Portion'],
  ['Vollkornnudeln (gekocht)', 'Getreide', 145, 6, 26, 1.2, 200, 'Teller'],
  ['Reis (gekocht)', 'Getreide', 130, 2.7, 28, 0.3, 150, 'Portion'],
  ['Reis (roh)', 'Getreide', 349, 7, 77.8, 0.6, 75, 'Portion'],
  ['Basmatireis (gekocht)', 'Getreide', 121, 3.5, 25, 0.4, 150, 'Portion'],
  ['Couscous (gekocht)', 'Getreide', 112, 3.8, 23, 0.2, 150, 'Portion'],
  ['Quinoa (gekocht)', 'Getreide', 120, 4.4, 21.3, 1.9, 150, 'Portion'],
  ['Müsli (ungezuckert)', 'Getreide', 360, 10, 60, 7, 60, 'Portion'],
  ['Cornflakes', 'Getreide', 378, 7, 84, 0.9, 30, 'Portion'],
  ['Granola', 'Getreide', 450, 9, 62, 17, 50, 'Portion'],
  ['Wraps (Weizen)', 'Getreide', 300, 8, 50, 7, 60, 'Stück'],
  ['Pizza Margherita', 'Gerichte', 250, 11, 30, 9, 350, 'Pizza'],

  // Kartoffeln
  ['Kartoffeln (gekocht)', 'Gemüse', 72, 2, 15, 0.1, 200, 'Portion'],
  ['Süßkartoffel (gekocht)', 'Gemüse', 86, 1.6, 20, 0.1, 200, 'Portion'],
  ['Pommes frites', 'Gerichte', 291, 3.4, 35, 15, 150, 'Portion'],
  ['Bratkartoffeln', 'Gerichte', 150, 2.5, 18, 7, 200, 'Portion'],
  ['Kartoffelpüree', 'Gerichte', 95, 2, 13, 4, 200, 'Portion'],

  // Gemüse
  ['Brokkoli', 'Gemüse', 34, 2.8, 4, 0.4, 150, 'Portion'],
  ['Blumenkohl', 'Gemüse', 25, 1.9, 3, 0.3, 150, 'Portion'],
  ['Karotte', 'Gemüse', 36, 0.9, 7.5, 0.2, 80, 'Stück'],
  ['Gurke', 'Gemüse', 15, 0.6, 2.8, 0.1, 100, 'halbe'],
  ['Tomate', 'Gemüse', 18, 0.9, 3.9, 0.2, 80, 'Stück'],
  ['Paprika (rot)', 'Gemüse', 31, 1, 6, 0.3, 150, 'Stück'],
  ['Zucchini', 'Gemüse', 17, 1.2, 3.1, 0.3, 150, 'Portion'],
  ['Spinat', 'Gemüse', 23, 2.9, 3.6, 0.4, 100, 'Portion'],
  ['Eisbergsalat', 'Gemüse', 14, 0.9, 3, 0.1, 80, 'Portion'],
  ['Champignons', 'Gemüse', 22, 3.1, 3.3, 0.3, 100, 'Portion'],
  ['Zwiebel', 'Gemüse', 40, 1.1, 9, 0.1, 60, 'Stück'],
  ['Erbsen (TK)', 'Gemüse', 81, 5.4, 14.5, 0.4, 100, 'Portion'],
  ['Mais (Dose)', 'Gemüse', 86, 3.3, 19, 1.2, 70, 'Portion'],
  ['Grüne Bohnen', 'Gemüse', 31, 1.8, 7, 0.2, 150, 'Portion'],
  ['Avocado', 'Gemüse', 160, 2, 8.5, 14.7, 80, 'halbe'],
  ['Kidneybohnen (Dose)', 'Hülsenfrüchte', 110, 7.5, 16, 0.6, 120, 'Portion'],
  ['Kichererbsen (Dose)', 'Hülsenfrüchte', 120, 7, 17, 2.5, 120, 'Portion'],
  ['Linsen (gekocht)', 'Hülsenfrüchte', 116, 9, 20, 0.4, 150, 'Portion'],
  ['Tofu', 'Hülsenfrüchte', 144, 15, 2, 8.7, 100, 'Portion'],

  // Obst
  ['Apfel', 'Obst', 52, 0.3, 13.8, 0.2, 180, 'Stück'],
  ['Banane', 'Obst', 89, 1.1, 22.8, 0.3, 120, 'Stück'],
  ['Orange', 'Obst', 47, 0.9, 11.8, 0.1, 150, 'Stück'],
  ['Birne', 'Obst', 57, 0.4, 15, 0.1, 170, 'Stück'],
  ['Erdbeeren', 'Obst', 32, 0.7, 7.7, 0.3, 150, 'Schale'],
  ['Heidelbeeren', 'Obst', 57, 0.7, 14.5, 0.3, 125, 'Schale'],
  ['Weintrauben', 'Obst', 69, 0.7, 18, 0.2, 125, 'Portion'],
  ['Kiwi', 'Obst', 61, 1.1, 14.7, 0.5, 75, 'Stück'],
  ['Mango', 'Obst', 60, 0.8, 15, 0.4, 150, 'Portion'],
  ['Ananas', 'Obst', 50, 0.5, 13, 0.1, 150, 'Portion'],
  ['Wassermelone', 'Obst', 30, 0.6, 7.6, 0.2, 250, 'Stück'],
  ['Datteln (getrocknet)', 'Obst', 282, 2.5, 75, 0.4, 25, '3 Stück'],
  ['Rosinen', 'Obst', 299, 3.1, 79, 0.5, 30, 'Handvoll'],

  // Milchprodukte & Eier
  ['Milch 1,5 %', 'Milch & Ei', 47, 3.4, 4.8, 1.5, 250, 'Glas'],
  ['Milch 3,5 %', 'Milch & Ei', 64, 3.3, 4.8, 3.5, 250, 'Glas'],
  ['Hafermilch', 'Milch & Ei', 46, 1, 6.7, 1.5, 250, 'Glas'],
  ['Magerquark', 'Milch & Ei', 67, 12, 4, 0.3, 250, 'Becher'],
  ['Skyr natur', 'Milch & Ei', 63, 11, 4, 0.2, 150, 'Becher'],
  ['Griechischer Joghurt 10 %', 'Milch & Ei', 133, 5, 4, 10, 150, 'Becher'],
  ['Naturjoghurt 1,5 %', 'Milch & Ei', 47, 3.4, 4.8, 1.5, 150, 'Becher'],
  ['Fruchtjoghurt', 'Milch & Ei', 95, 3.5, 14, 2.6, 150, 'Becher'],
  ['Hüttenkäse', 'Milch & Ei', 98, 12.3, 2.7, 4.3, 200, 'Becher'],
  ['Gouda', 'Milch & Ei', 356, 25, 0, 28, 30, 'Scheibe'],
  ['Emmentaler', 'Milch & Ei', 380, 28, 0, 30, 30, 'Scheibe'],
  ['Mozzarella', 'Milch & Ei', 254, 18, 1, 20, 125, 'Kugel'],
  ['Feta', 'Milch & Ei', 264, 14, 4, 21, 50, 'Portion'],
  ['Parmesan', 'Milch & Ei', 431, 38, 0, 29, 10, 'EL gerieben'],
  ['Frischkäse', 'Milch & Ei', 250, 5.5, 3.5, 24, 30, 'Portion'],
  ['Butter', 'Milch & Ei', 741, 0.7, 0.6, 82, 10, 'Portion'],
  ['Ei (Größe M)', 'Milch & Ei', 155, 13, 1.1, 11, 60, 'Stück'],
  ['Eiklar', 'Milch & Ei', 52, 11, 0.7, 0.2, 33, 'Stück'],
  ['Sahne 30 %', 'Milch & Ei', 292, 2.4, 3.2, 30, 20, 'Schuss'],

  // Fleisch, Fisch
  ['Hähnchenbrust', 'Fleisch & Fisch', 110, 23, 0, 1.5, 150, 'Filet'],
  ['Putenbrust', 'Fleisch & Fisch', 105, 24, 0, 1, 150, 'Filet'],
  ['Rinderhack', 'Fleisch & Fisch', 250, 18, 0, 20, 125, 'Portion'],
  ['Rindersteak', 'Fleisch & Fisch', 158, 22, 0, 7.5, 200, 'Steak'],
  ['Schweineschnitzel', 'Fleisch & Fisch', 120, 22, 0, 3.5, 150, 'Stück'],
  ['Schnitzel (paniert)', 'Fleisch & Fisch', 230, 18, 12, 12, 180, 'Stück'],
  ['Bratwurst', 'Fleisch & Fisch', 297, 13, 1, 27, 100, 'Stück'],
  ['Wiener Würstchen', 'Fleisch & Fisch', 280, 12, 1, 25, 50, 'Stück'],
  ['Salami', 'Fleisch & Fisch', 380, 22, 1, 32, 20, '4 Scheiben'],
  ['Kochschinken', 'Fleisch & Fisch', 110, 19, 1, 3.5, 20, 'Scheibe'],
  ['Putenaufschnitt', 'Fleisch & Fisch', 100, 20, 1, 2, 20, 'Scheibe'],
  ['Lachs', 'Fleisch & Fisch', 208, 20, 0, 13, 125, 'Filet'],
  ['Thunfisch (Dose, Wasser)', 'Fleisch & Fisch', 116, 26, 0, 1, 130, 'Dose'],
  ['Kabeljau', 'Fleisch & Fisch', 82, 18, 0, 0.7, 150, 'Filet'],
  ['Garnelen', 'Fleisch & Fisch', 85, 18, 0.5, 1, 100, 'Portion'],
  ['Döner Kebab', 'Gerichte', 215, 12, 20, 9.5, 400, 'Stück'],

  // Nüsse, Fette
  ['Mandeln', 'Nüsse & Fette', 579, 21, 9.5, 50, 30, 'Handvoll'],
  ['Walnüsse', 'Nüsse & Fette', 654, 15, 7, 65, 30, 'Handvoll'],
  ['Cashewkerne', 'Nüsse & Fette', 553, 18, 30, 44, 30, 'Handvoll'],
  ['Erdnüsse', 'Nüsse & Fette', 567, 26, 12, 49, 30, 'Handvoll'],
  ['Erdnussbutter', 'Nüsse & Fette', 588, 25, 16, 50, 15, 'EL'],
  ['Olivenöl', 'Nüsse & Fette', 884, 0, 0, 100, 10, 'EL'],
  ['Rapsöl', 'Nüsse & Fette', 884, 0, 0, 100, 10, 'EL'],
  ['Chiasamen', 'Nüsse & Fette', 486, 17, 8, 31, 15, 'EL'],
  ['Leinsamen', 'Nüsse & Fette', 534, 18, 1.6, 42, 10, 'EL'],

  // Süßes & Snacks
  ['Vollmilchschokolade', 'Süßes & Snacks', 535, 7.6, 57, 30, 25, '5 Stückchen'],
  ['Zartbitterschokolade 70 %', 'Süßes & Snacks', 580, 8, 36, 43, 20, '4 Stückchen'],
  ['Gummibärchen', 'Süßes & Snacks', 343, 6.9, 77, 0.5, 25, 'Handvoll'],
  ['Kartoffelchips', 'Süßes & Snacks', 536, 6, 53, 34, 30, 'Handvoll'],
  ['Butterkeks', 'Süßes & Snacks', 440, 7.5, 74, 12, 5, 'Stück'],
  ['Vanilleeis', 'Süßes & Snacks', 207, 3.5, 24, 11, 70, 'Kugel'],
  ['Honig', 'Süßes & Snacks', 304, 0.3, 82, 0, 20, 'TL (gehäuft)'],
  ['Marmelade', 'Süßes & Snacks', 250, 0.4, 60, 0.1, 20, 'Portion'],
  ['Nuss-Nougat-Creme', 'Süßes & Snacks', 539, 6.3, 57.5, 31, 15, 'Portion'],
  ['Proteinriegel', 'Süßes & Snacks', 360, 33, 30, 12, 60, 'Riegel'],
  ['Müsliriegel', 'Süßes & Snacks', 420, 6, 64, 15, 25, 'Riegel'],
  ['Käsekuchen', 'Süßes & Snacks', 250, 7, 25, 13, 120, 'Stück'],
  ['Apfelstrudel', 'Süßes & Snacks', 260, 3, 35, 12, 120, 'Stück'],
  ['Zucker', 'Süßes & Snacks', 400, 0, 100, 0, 5, 'TL'],

  // Getränke
  ['Kaffee schwarz', 'Getränke', 2, 0.1, 0.3, 0, 200, 'Tasse'],
  ['Cappuccino', 'Getränke', 40, 2, 3.5, 2, 200, 'Tasse'],
  ['Latte Macchiato', 'Getränke', 50, 2.8, 4, 2.4, 300, 'Glas'],
  ['Orangensaft', 'Getränke', 45, 0.7, 10.4, 0.2, 200, 'Glas'],
  ['Apfelschorle', 'Getränke', 24, 0.1, 5.6, 0, 330, 'Glas'],
  ['Cola', 'Getränke', 42, 0, 10.6, 0, 330, 'Dose'],
  ['Cola Zero', 'Getränke', 0.3, 0, 0, 0, 330, 'Dose'],
  ['Bier (Pils)', 'Getränke', 42, 0.5, 3, 0, 500, 'Flasche', true],
  ['Alkoholfreies Bier', 'Getränke', 26, 0.4, 5.5, 0, 500, 'Flasche'],
  ['Rotwein', 'Getränke', 85, 0.1, 2.6, 0, 200, 'Glas', true],
  ['Proteinshake (Whey, Pulver)', 'Getränke', 380, 78, 6, 5, 30, 'Messlöffel'],

  // Saucen
  ['Ketchup', 'Saucen', 112, 1.2, 25, 0.2, 15, 'EL'],
  ['Mayonnaise', 'Saucen', 680, 1, 1.5, 75, 15, 'EL'],
  ['Senf', 'Saucen', 66, 4.4, 5, 3.5, 10, 'TL'],
  ['Pesto', 'Saucen', 450, 5, 6, 45, 30, 'Portion'],
  ['Tomatensauce', 'Saucen', 45, 1.5, 7, 1, 125, 'Portion'],
  ['Hummus', 'Saucen', 240, 7, 14, 17, 50, 'Portion'],
];

export const FOODS = RAW.map(([name, category, kcal, protein, carbs, fat, portion, portionLabel, alcohol], i) => ({
  id: `db-${i}`,
  name,
  category,
  kcal,
  protein,
  carbs,
  fat,
  portion,
  portionLabel,
  ...(alcohol ? { alcohol: true } : {}),
}));

export const CATEGORIES = [...new Set(FOODS.map((f) => f.category))];

/** Einfache unscharfe Suche: alle Suchwörter müssen im Namen vorkommen. */
export function searchFoods(list, query) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list
    .filter((f) => words.every((w) => f.name.toLowerCase().includes(w)))
    .sort((a, b) => a.name.toLowerCase().indexOf(words[0]) - b.name.toLowerCase().indexOf(words[0]));
}
