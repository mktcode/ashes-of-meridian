# Kartenbetrachter, Capture und Diagnose

## Karten betrachten

Nach Build `map-viewer.html` direkt öffnen, optional `?map=westmark&seed=93401206`.
Kamera wie im Spiel, zusätzlich Gesamtansicht, Tageszeit, Dunst und Kartenrahmen.
Kein Profilzugriff, Kampf oder Autosave. **Export recipe** erzeugt ein Capture-Rezept.
Normale Kameragrenzen schützen die endliche Geländeabdeckung; freie technische
Orbit-/Look-at-Kameras sind davon ausgenommen.

**Map diagnostics → Analyze map** zeigt CPU-Klippen, breite Verbindungen, Wirtschaft,
Startkandidaten, HQ-Terrainproben und Höhenprofile. **Export report** exportiert diese
Analyse getrennt vom Szenenrezept. HQ-Proben prüfen keine Belegung/Sicht/Kosten;
statische Verbindungen beweisen keinen Gruppenverkehr oder faire Starts. Abtrag/Auffüllung
bezieht sich auf das wirtschaftlich gestützte Gelände vor Korridoren. Die Gerade-/Datum-
Gegenprobe enthält keine Anschlussreparaturen und ist keine alte Generatorversion.

## Bilder aufnehmen

```bash
npm run capture:scene -- --scene scripts/scenes/map-overview.json --output .tmp/map-overview
npm run capture:scene -- --scene /pfad/zum/viewer-export.json --reuse-build
```

Optionen: `node scripts/scene-capture.mjs --help` (ohne Build/Browser).
Beispiele: [Kartenansichten](../scripts/scenes/map-overview.json),
[Modelle](../scripts/scenes/model-lineup.json). Rezepttypen und Validierung sind im
Code maßgeblich, keine parallele Feld-/Grenzwertliste in Markdown.
`--reuse-build` prüft Quellen- und Payloadkennung; veraltete Builds werden abgewiesen.

Vorrang: Defaults → Szenenrezept → benannte Ansicht → CLI. Renderfilter verändern
keinen CPU-Bestand; arrangierte Objekte sind nicht regulär bezahlt/gebaut.
Seed allein konserviert keine Landschaft über Generatorversionen hinweg.
Vor dem Bild müssen Ressourcen bereit und der angeforderte Frame gerendert sein.
Bilder sind WebP/Qualität 80; JSON enthält Rezept, tatsächliche Kamera/Platzierung und Buildkontext.
Keine pixelgenaue Browser-/GPU-Garantie.

## Echtzeit messen

```bash
npm run diagnose:scene -- --case night-running --duration 5 --angle gl --require-hardware
```

Optionen: `node scripts/diagnose-scene.mjs --help`.
[Standardrezept](../scripts/diagnostics/recipes/dense-army.json): dichte arrangierte Armee,
Tag/Nacht und Pause/Laufend. Jeder Fall hat einen frischen Browser; Warmup und
GPU-Nachlauf gehören nicht zum Messfenster. Geplante Auswahl-/Gruppenbefehle sind UI-API-
Aufrufe, keine echten Pointerereignisse oder Eingabe-bis-Bild-Messung.
Ausgabe je Fall plus erfolgreicher Gesamtindex; Messgrenzen siehe [Prüfwerkzeuge](testing.md).

## Umgebung und Ausgaben

Installiertes Chromium erforderlich, optional `CHROMIUM_PATH`, `--headed`, `--angle gl`.
Kein Server, Browserdownload oder Sicherheitslockerung. `--require-hardware` weist
Software/Unbekannt ab; Treiberstrings sind kein unabhängiger Hardwarebeweis.
Headless-/Software-WebGL oder kurze synthetische Fälle ersetzen keinen Nutzer-Spielstand,
Firefox-, Mobil-, Thermik- oder menschlichen Bildnachweis.

Ausgaben in neue eigene worktree-lokale `.tmp/`-Verzeichnisse, Bilder alternativ
bewusst unter `release/itch-media/`. Bestehende Ausgaben/Symlink-Eltern nicht überschreiben.
Werkzeuge räumen eigenes Browser-Scratch auf, Teilresultate bleiben bei Fehlern erhalten.
Marketingaufnahmen über `capture:itch` sind ein separater [Veröffentlichungsworkflow](deployment.md).
Keine vorsorglichen Screenshotserien; [Freigaben](../AGENTS.md#prüfungen).
