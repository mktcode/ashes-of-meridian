# Einzelne Szenen aufnehmen

```bash
npm run capture:scene -- --scene scripts/scenes/model-lineup.json
npm run capture:scene -- --scene scripts/scenes/model-lineup.json --hour 22 --width 390 --height 844 --hud --output .tmp/my-capture/night.webp
```

Chromium/Chrome muss installiert sein; bei Bedarf `CHROMIUM_PATH=/absoluter/browserpfad` setzen. Das Werkzeug baut den aktuellen Worktree und öffnet `index.html` über `file://` in einem isolierten, flüchtigen Browserprofil. Kein Server, kein Zugriff auf das persönliche Browserprofil. `node scripts/scene-capture.mjs --help` zeigt die Optionen ohne Build.

## Szenenrezept

Das [Beispiel](../scripts/scenes/model-lineup.json) kopieren und als JSON anpassen:

- `map`, `seed`: technische Karten-ID aus dem [Katalog](../src/battlefields/catalog.ts), positiver ganzzahliger Seed bis 99999999.
- `faction`, `enemy`: Fraktionen 0–2; Standard 0 gegen 1.
- `camera`: `x`, `z`, `zoom`, optional `yaw` in Radiant. Die Koordinaten beschreiben einen **Geländefokus**; die notwendige Höhenkorrektur der Spielkamera erfolgt automatisch.
- `entities`: bis zu 200 zusätzliche Objekte mit `kind` (`unit`/`building`), technischem `type`, `team` (0/1), `x`, `z`, optional `rot` in Radiant.
- Kamera und Objekte können `anchor` verwenden: `world` (Standard: absolute Koordinaten), `player` oder `enemy` (Offsets vom jeweiligen Landungsworker).
- `hour`: feste Tageszeit 0 bis kleiner 24; sonst seedabhängige Startzeit. Nur die lokale Renderuhr wird verschoben, keine Simulation.
- `width`, `height`: ganze Pixelmaße 64–4096, Standard 1920×1080. Pixelskalierung 1.
- `hud`: standardmäßig aus; `--hud` aktiviert es. Meldungen und Pausemodal werden für Aufnahmen ausgeblendet.
- `reveal`: standardmäßig vollständige Sicht; `false` erhält normale Spielersicht.

CLI-Optionen überschreiben die gleichnamigen Rezeptwerte. Unbekannte Rezeptfelder werden abgewiesen. Entitätstypen sind in [Content](../src/content.ts) definiert.

## Ausgabe und Grenzen

Pro Aufruf genau eine WebP-Aufnahme, Qualität 80, und `<bild>.webp.json` mit effektivem Rezept, aufgelösten Positionen/Kamera, Browserkennung und geprüftem Zustand. Ohne `--output` entsteht ein laufbezogenes Verzeichnis unter `.tmp/`. Browser-Scratch bleibt ebenfalls im eigenen Worktree; bei langen Linux-Pfaden dient `/proc/<prozess>/cwd` als kurzer Alias auf diesen eigenen Scratchordner, um Chromiums Unix-Socket-Pfadlimit einzuhalten.

Die Szene bleibt bei Simulationszeit 0 pausiert; es gibt weder Echtzeit-Wartekämpfe noch automatische KI-Partien. Der Browser erhält lediglich ein begrenztes Renderfenster, anschließend wird seine Uhr eingefroren. Seiten-/Konsolen-/WebGL-Fehler oder unerwarteter Simulationsfortschritt brechen die Aufnahme ab.

Die normale seedbasierte Welt mit Ressourcen und Landungsworkern bleibt bestehen. Zusätzliche Gebäude werden **arrangiert**, ohne Baukosten, Bauzeit oder Bauplatzprüfung; Überlappungen und ungeeignete Fundamente liegen in der Verantwortung des Rezeptautors. Einheiten nutzen die normale lokale Spawn-Platzsuche, können leicht versetzt werden oder auf unzugänglichem Terrain ausdrücklich scheitern; der Bericht enthält ihre tatsächlichen Positionen. Das erlaubt auch isolierte Gebäude-/Hangvergleiche, ist aber kein Nachweis legaler Spielsituationen oder Balance.

Gezielter CPU-Test des Rezeptvertrags und serialisierten Callbacks: `node --test tests/scene-capture.check.cjs` (kein Browserlauf).

Rezept und Seed sind innerhalb desselben Builds wiederverwendbar, keine pixelgenaue Garantie über Browser, GPU, Spielversionen oder animierte Posteffekte hinweg. Die Aufnahme wird mit höchster Renderqualität erzeugt. Visuelle und echte Mobilgeräteabnahme bleibt menschlich. Das spezielle `capture:itch` bleibt ein separates, unverändertes Marketingwerkzeug.
