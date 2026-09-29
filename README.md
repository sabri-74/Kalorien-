# Kalorien & Fitness

Eine Web-App zum Kalorienzählen und Trainieren. Sie läuft komplett im Browser, funktioniert offline
und lässt sich auf dem Handy wie eine normale App installieren. Alle Daten bleiben auf deinem Gerät.

## Funktionen

**Tagebuch**
- Tageskalorienbudget als Ring: Ziel − Gegessen + Training = Übrig
- Eiweiß, Kohlenhydrate und Fett mit Tageszielen
- Vier Mahlzeiten (Frühstück, Mittag, Abend, Snacks), Einträge antippen zum Bearbeiten
- „Von gestern übernehmen“ für wiederkehrende Mahlzeiten
- Wasser-Tracker mit Gläsern (Ziel ≈ 35 ml pro kg Körpergewicht)
- Blättern zwischen Tagen

**Lebensmittel**
- Eingebaute Datenbank mit über 140 gängigen Lebensmitteln (pro 100 g, mit typischen Portionen)
- Online-Suche und Barcode-Suche über [Open Food Facts](https://world.openfoodfacts.org)
- Barcode-Scan mit der Kamera (Chrome/Android; sonst EAN von Hand eingeben)
- Eigene Lebensmittel anlegen, „Zuletzt verwendet“-Liste

**Training**
- Ausdauer eintragen: über 20 Aktivitäten, Kalorienverbrauch per MET-Wert und Körpergewicht
- Krafttraining mit Sätzen, Wiederholungen und Gewicht; Werte vom letzten Mal werden vorgeschlagen
- Fertige Pläne: Ganzkörper, Push/Pull/Beine, Oberkörper/Unterkörper, Zuhause ohne Geräte
- Pausentimer (90 s) nach jedem erledigten Satz, mit Vibration
- Übungsbibliothek mit Technik-Tipps, persönliche Bestleistungen (geschätztes 1RM nach Epley)

**Fortschritt**
- Serie (Tage in Folge), Ø Kalorien, Gewichtsverlauf, BMI
- Kalorien-Diagramm für 7 oder 30 Tage mit Ziellinie
- Gewichtskurve mit Trendlinie (gleitender Durchschnitt) und Zielgewicht

**Profil**
- Bedarf nach Mifflin-St-Jeor (Grundumsatz × Aktivitätsfaktor), Ziel Abnehmen/Halten/Aufbauen
- Automatische Makroziele (Eiweiß nach Körpergewicht), eigenes Kalorienziel möglich
- Hell-/Dunkelmodus, Sicherung als JSON-Datei exportieren und importieren, Beispieldaten

## Starten

Keine Installation und kein Build nötig. Die Dateien müssen nur über einen Webserver ausgeliefert werden
(wegen der JavaScript-Module reicht Doppelklick auf `index.html` nicht):

```bash
npm start            # oder: python3 -m http.server 8080
```

Dann <http://localhost:8080> öffnen.

### Aufs Handy bringen

Am einfachsten über **GitHub Pages**: im Repository unter *Settings → Pages* den Branch auswählen und
speichern. Danach die angezeigte Adresse auf dem Handy öffnen und „Zum Startbildschirm hinzufügen“ wählen.
Die App funktioniert anschließend auch ohne Internet.

## Tests

```bash
npm test
```

Prüft die Berechnungen (Grundumsatz, Kalorienziel, Makros, BMI, MET, 1RM, Datumslogik) und die
Konsistenz der Lebensmittel- und Übungsdaten.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html`, `styles.css` | App-Gerüst und Design (Hell/Dunkel) |
| `js/app.js` | Oberfläche und Bedienung |
| `js/calc.js` | Reine Rechenfunktionen (getestet) |
| `js/foods.js` | Lebensmittel-Datenbank und Suche |
| `js/exercises.js` | Übungen, Ausdauer-MET-Werte, Trainingspläne |
| `js/store.js` | Speicherung im Browser (localStorage) |
| `js/charts.js` | SVG-Diagramme ohne Bibliothek |
| `sw.js`, `manifest.webmanifest` | Offline-Betrieb und Installation als App |

> Die Werte sind Schätzungen und ersetzen keine ärztliche oder ernährungsfachliche Beratung.
