# Kalorien & Fitness

Eine Web-App zum Kalorienzählen und Trainieren, mit KI-Foto-Erkennung. Sie läuft komplett im Browser,
funktioniert offline und lässt sich auf dem Handy wie eine normale App installieren.
Deine Daten bleiben auf deinem Gerät.

## Funktionen

**KI-Kalorienerkennung**
- Auf den orangefarbenen Kamera-Knopf tippen, das Essen fotografieren, fertig: Die KI erkennt jede
  Komponente (Beilage, Soße, Getränk …), schätzt die Menge in Gramm und die Nährwerte.
- Vor dem Eintragen lässt sich alles anpassen: Mengen per +/−, Namen ändern, Zutaten entfernen.
- „Etwas stimmt nicht?“: der KI eine Korrektur schreiben („das ist Vollkornreis, nur eine halbe Portion“),
  dann schätzt sie neu.
- Ohne Foto geht es auch: „Essen beschreiben“, z. B. „Döner mit allem und eine Cola“.
- Jedes Ergebnis kann direkt als **Gericht** gespeichert werden.

**Eigene Gerichte**
- Rezepte aus Zutaten der Datenbank zusammenstellen, mit Portionenzahl, optional mit Foto.
- Mit einem Tipp wieder eintragen (½, 1, 1½ oder 2 Portionen).
- Eine Mahlzeit aus dem Tagebuch „Als Gericht speichern“.
- Fünf Vorlagen zum Start (Porridge, Hähnchen-Reis, Bolognese, Griechischer Salat, Skyr-Bowl).

**Tagebuch**
- Wochenleiste mit Mini-Ringen: Auf einen Blick sieht man, welche Tage im Ziel waren.
- Kalorien-Ring (Ziel − Gegessen + Training) und Makros mit „noch … g“.
- Eine Suche für alles: Datenbank (135 Lebensmittel), eigene Lebensmittel, Gerichte, Favoriten,
  zuletzt verwendet, Online-Suche über Open Food Facts, Barcode (Kamera oder Eingabe).
- Schnelleintrag „Nur kcal“, „Wie gestern“, Einträge antippen zum Bearbeiten, Löschen mit „Rückgängig“.
- Wasser-Tracker.

**Training**
- Ausdauer mit über 20 Sportarten (Verbrauch per MET-Wert und Körpergewicht).
- Krafttraining mit Plänen, Werten vom letzten Mal, Satz-Häkchen und 90-Sekunden-Pausentimer.
- Übungsbibliothek mit Technik-Tipps, Bestleistungen (geschätztes 1RM).

**Statistik**
- Serie, Tage im Ziel, Ø Kalorien, Gewicht und BMI.
- KI-Coach: persönliche Tipps aus den letzten 7 Tagen.
- Diagramme für Kalorien (7/30 Tage) und Gewicht mit Trendlinie und Zielgewicht.

**Einrichtung & Profil**
- Assistent beim ersten Start: Ziel → Körperdaten → Aktivität → persönliches Tagesziel.
- Bedarf nach Mifflin-St Jeor, automatische Makroziele, eigenes Kalorienziel möglich.
- Hell-/Dunkelmodus, Sicherung als Datei, Beispieldaten.

## KI einrichten

Die eigenständige App ruft die Claude API direkt aus dem Browser auf. Dafür braucht sie einen eigenen
API-Schlüssel:

1. Unter <https://console.anthropic.com/settings/keys> einen Schlüssel anlegen (Guthaben aufladen).
2. In der App: Profil → **KI-Erkennung** → Schlüssel einfügen → „Schlüssel speichern“.

Der Schlüssel wird nur im Browser dieses Geräts gespeichert, nicht in Sicherungsdateien exportiert und
nur an `api.anthropic.com` gesendet. Eine Foto-Analyse kostet je nach Bild etwa 1 bis 3 Cent.
Verwendet wird das Modell `claude-opus-5-5`.

> Hinweis: Wer die App öffentlich hostet, sollte bedenken, dass jeder Nutzer seinen eigenen Schlüssel
> eintragen muss. Für eine App mit vielen Nutzern gehört der Schlüssel auf einen eigenen Server.

## Starten

Keine Installation und kein Build nötig; die Dateien müssen nur über einen Webserver ausgeliefert werden:

```bash
npm start            # oder: python3 -m http.server 8080
```

Dann <http://localhost:8080> öffnen.

### Aufs Handy bringen

Am einfachsten über **GitHub Pages**: im Repository unter *Settings → Pages* den Branch auswählen und
speichern. Die angezeigte Adresse auf dem Handy öffnen und „Zum Startbildschirm hinzufügen“ wählen.
Danach funktioniert die App auch offline (nur KI und Online-Suche brauchen Internet).

## Tests

```bash
npm test
```

Prüft Berechnungen (Bedarf, Makros, BMI, MET, 1RM, Gerichte, Bereinigung der KI-Antworten),
die Übernahme von Daten aus der ersten App-Version und die Konsistenz der Lebensmittel- und Übungsdaten.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html`, `styles.css` | App-Gerüst und Design (Hell/Dunkel) |
| `js/app.js` | Start, Navigation, Ereignis-Verteilung |
| `js/core.js` | Gemeinsamer Zustand, Ziele, Sheets, Meldungen |
| `js/views/*.js` | Tagebuch, Hinzufügen, KI-Erkennung, Gerichte, Training, Statistik, Profil |
| `js/ai.js` | KI-Anbindung (Claude API bzw. Claude-Vorschau) |
| `js/photos.js` | Fotos verkleinern, Vorschaubilder in IndexedDB |
| `js/calc.js` | Reine Rechenfunktionen (getestet) |
| `js/foods.js`, `js/exercises.js` | Lebensmittel-, Übungs- und Plandaten |
| `js/store.js` | Speicherung und Datenmigration |
| `js/charts.js`, `js/icons.js` | SVG-Diagramme und Icons ohne Bibliothek |
| `sw.js`, `manifest.webmanifest` | Offline-Betrieb und Installation als App |

> Alle Werte, auch die der KI, sind Schätzungen und ersetzen keine ärztliche oder
> ernährungsfachliche Beratung.
