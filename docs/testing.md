# Prüfwerkzeuge

Freigaben, Zeitbudget und Pflichtnachweise stehen ausschließlich in [AGENTS](../AGENTS.md#prüfungen).
Eine grüne technische Prüfung ist keine menschliche Grafik-, Audio-, Balance- oder Geräteabnahme.

## Gezielt prüfen

Dokumentation: Diff und `npm run check:docs` (Dateiziele, **keine Ankerprüfung**).
Code: einmal bauen, dann kleinste betroffene Datei/Fälle in einem neuen Prozess:

```bash
npm run build
node --max-old-space-size=128 --test --test-concurrency=1 --test-name-pattern='profile defaults' tests/ashes-of-meridian-persistence.check.cjs
```

Namen mit `rg 'test\(' tests` suchen. Namensfilter verhindern nicht jeden Dateiaufbau;
übersprungene Fälle sind nicht bestanden. `node scripts/run-tests.mjs <bereich> --list`
zeigt die Auswahl ohne Build/Lauf. Gruppen und Standardauswahl können mehrere Minuten
kosten; Start-Upgrade-Fälle gehören ebenfalls zur freigabepflichtigen Simulationauswahl.

`npm run check:quality` umfasst begrenztes Lint/Format, Repository-Besitz, Dokumentationslinks,
Build und ausgewählte Core-/Werkzeugverträge. Kein echter Browser und keine Spielabnahme.
CI verwendet denselben Befehl mit Node aus `.nvmrc`.
Lint/Format erfassen nur [tooling-files.json](../scripts/tooling-files.json), nicht alle Spielquellen;
`npm run format` schreibt. Keine globale Formatierung oder Modulmigration daraus ableiten.
`check:repository` prüft Ignore-/Besitzregeln, löscht aber nichts.

## Browser

Installiertes Chromium, optional `CHROMIUM_PATH`; kein Download oder gelockerter Dateizugriff.

- `npm run check:browser`: echter `file://`-Start, Shader/GL und Kontextverlust mit Recovery-UI.
- `npm run check:map-viewer`: profilfreier Viewer, Kamera, Resize, Seedwechsel und Export.

Kein Pixel-, Leckfreiheits-, Touchkomfort- oder Geräteperformancebeweis.
Node führt kein GLSL aus; Shaderprüfungen schützen Schnittstellen, nicht Bildqualität.
Feste Referenzen gemäß [Referenzpflege](reference-tests.md), niemals zum Grünmachen regenerieren.

## Diagnose und manuelle Einstiege

`index.html?diagnostics=1` aktiviert lokale Aufzeichnung mit JSON-Export, ohne Telemetrie.
Berichte mit Buildkennung und Szenenkontext zuordnen. CPU-Unterphasen sind exklusive
Anteile ihrer Hauptphase; GPU-Zeiten überlappen CPU. Fehlende/disjoint Timer sind keine
Nullkosten, geschätzte Bytes kein Treiberspeicher. Eingabeereignisse messen synchrone
Handlerarbeit, nicht Eventqueue-Latenz oder Eingabe-bis-Bild. Firefox kann GPU-Timer fehlen.

Reproduzierbare begrenzte Messfenster und Bildaufnahme: [Capture/Diagnose](scene-capture.md).
Messfragen und Vorher/Nachher-Kontext: [Performance](issues/performance-und-mobilstabilitaet.md).

Nach Build ohne normales Profil:

- `map-viewer.html`: Landschaft ohne Simulation.
- `index.html?experiment=<karten-id>&seed=<seed>`: isolierter Katalogstart; IDs im Code.
- `index.html?experiment=height`: Höhen-/Sichtprobe mit zwei Workern.
- `index.html?models=civilian-upgrades`: zivile Modellgalerie.

`npm run simulate:visible` ist eine persönliche KI-Zuschauerpartie, nie automatisch durch Agenten starten.
