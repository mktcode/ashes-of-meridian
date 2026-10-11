# Reproduzierbare Chromium-Diagnose

```bash
npm run diagnose:scene -- --angle gl --require-hardware
npm run diagnose:scene -- --case night-running --duration 5 --angle gl --require-hardware
```

Der Runner baut den eigenen Worktree und lädt eine arrangierte Szene über `file://` in einem isolierten Chromium-Profil. Standard ist das [Rezept für eine dichte Armee](../scripts/diagnostics/recipes/dense-army.json): 144 Schützen, gleicher Seed und gleiche Kamera, Tag/Nacht jeweils pausiert/laufend, je eine Sekunde pausiertes Warmup und fünf Sekunden **echte Browserzeit**. Auswahl, Gruppenbefehl und erneute Auswahl erfolgen an festen relativen Zeitpunkten. Kein Server, persönliches Browserprofil, Screenshot oder automatische Zuschauerpartie.

Chromium muss installiert sein; `CHROMIUM_PATH` wählt ausdrücklich einen anderen ausführbaren Browser. `--angle gl` fordert ANGLE/OpenGL an, ohne Sandbox oder Dateisicherheit zu lockern. Ohne diesen Parameter bleibt Chromiums Backendwahl unverändert; sie kann auch Software-WebGL ergeben. `--headed` öffnet statt Headless ein temporäres Browserfenster und benötigt eine verfügbare Anzeige. `--require-hardware` bricht bei Software oder unbekanntem Renderer **vor** dem Szenenaufbau ab. WebGL-Rendererstrings sind Treiberangaben, kein unabhängiger Hardwarebeweis. Grafikbackend und Fenster-/ANGLE-Modus stehen in jedem Ergebnis; fehlende GPU-Timer sind ausdrücklich nicht verfügbar, niemals Nullkosten.

`node scripts/diagnose-scene.mjs --help` zeigt Optionen ohne Build/Browser. `--recipe <datei.json>` lädt ein eigenes Rezept; `--case <name>` beschränkt auf genau einen Fall, `--duration <sekunden>` überschreibt dessen Messdauer (1–20 Sekunden, Millisekundenauflösung).

## Rezeptvertrag

- `scene`: [bestehendes Szenenrezept](scene-capture.md#szenenrezept), insbesondere Karte/Seed, Fraktionen, Kamera und Viewport. Diagnose verwendet normale Sicht (`reveal: false`, Standard), Renderqualität High und DPR 1. Zusätzliche Einheiten werden vor dem ersten Render in die normale Sichtberechnung einbezogen. Objekte sind arrangiert, nicht bezahlt/produziert; die normale Terrain- und lokale Spawn-Platzsuche bleibt erhalten.
- `army`: eigener Einheiten-`type`, `count` 1–200, `columns` 1–count, `spacing` 0,1–20, `x`, `z` und optional `anchor` (`player` als Standard, sonst `enemy`/`world`). Das Raster wird um `x/z` zentriert und an die vorhandenen `scene.entities` angehängt; zusammen weiterhin höchstens 200 zusätzliche Objekte. Gelände kann die tatsächlichen Spawnpositionen verschieben oder Platzierung verhindern. Ergebnis enthält die aufgelösten Positionen; kein Terrain wird geräumt oder eingeebnet.
- `cases`: 1–4 eindeutige Einträge mit dateisicherem `name`, Tagesstunde `hour` (0 bis kleiner 24) und booleschem `paused`. Jeder Fall erhält einen frischen Browser und Kontext. Alle beginnen nach pausiertem Warmup im gleichen CPU-Anfangszustand. Laufende Fälle verwenden normale Ticks einschließlich vorhandener KI; Tageszeit und Armee können sich danach regulär weiterentwickeln.
- `warmupMs`: 0–5000, Standard 1000; `durationMs`: 1000–20000, Standard 5000. Ganzzahlige Millisekunden, keine virtuelle oder angehaltene Browseruhr.
- `interactions`: höchstens acht streng aufsteigende Einträge mit `at` zwischen 0,01 und 0,95 als Anteil des Messfensters. `selectArmy` wählt die erzeugte Armee über die normale UI-API. `moveArmy` übermittelt einen Gruppenbefehl über dieselbe API und benötigt `target` mit `x/z` und optional `anchor` (Standard `player`). Aufgelöste Ziele müssen innerhalb der Karte liegen. Annahme eines Befehls garantiert keine vollständige Wegfindung oder Ankunft. Im Warmup erfolgt keine explizite Auswahl; die normale Startansicht kann aber bereits Modellressourcen laden. Erneute Auswahl kann Modellkacheln wiederverwenden.

Unbekannte Felder und ungültige Grenzen werden vor Browserstart abgewiesen. Bekannte Entitätstypen und tatsächliche Platzierbarkeit kann erst der Runtime-Szenenaufbau prüfen. Das Rezept ist kein vollständiger Spielstand und keine Garantie einer legal erspielten maximalen Armee. Gleicher Seed konserviert kein Terrain über Spiel-/Rezeptversionen hinweg.

## Ergebnisse und Messgrenzen

Ohne `--output` entsteht ein eindeutig benanntes Verzeichnis direkt unter dem eigenen `.tmp/`; beispielsweise `--output .tmp/my-diagnosis` wählt ein **neues**, noch nicht bestehendes Verzeichnis dort. Fremde/ältere Ausgaben werden nicht überschrieben, geteilte Scratch-Symlinks abgewiesen. Je erfolgreichem Fall entsteht `<name>.json`; `index.json` enthält nach vollständigem Erfolg das Eingaberezept, Optionen und Zusammenfassungen. Ein späterer Fehler lässt bereits geschriebene Fallberichte erhalten, aber erzeugt keinen erfolgreichen Index. Der Browser-Harness räumt sein eigenes Profil/Scratch auch bei Fehler oder Timeout auf.

Jeder Fall enthält:

- effektive Szene und tatsächliche Platzierung;
- angeforderte und tatsächliche Dauer, Anfangs-/Endkontext sowie geplante und tatsächliche API-Aufrufzeitpunkte;
- Browser-/Grafikbackend und die [bestehende lokale Diagnose](testing.md#lokale-performancediagnose) mit Buildkennung;
- ausschließlich Messfenster-Frames, -Interaktionen, -Ressourcensamples und neu berechnete Summaries. Die erste rAF-/Renderintervalldifferenz über die Warmup-Grenze wird ausgeschlossen. `callbacksSeen`/`eventsSeen` und GPU-Probezustand beschreiben weiterhin die ganze Sitzung, keine Fenster-Raten.

Laden, pausiertes Warmup und ein begrenzter GPU-Nachlauf von 250 ms sind nicht Teil der Summaries. Der Nachlauf lässt die normale Renderloop asynchrone Queries abholen; letzte Werte können dennoch fehlen. Ringüberlauf, weniger als zwei Renderframes, versteckte/unterbrochene Szene, verlorene Einheiten, abgelehnte Befehle, unerwarteter Simulationsfortschritt, wechselnde Kamera/Auflösung/Qualität sowie JavaScript-/Konsolen-/WebGL-Fehler brechen ab. Start und Falllauf haben harte Zeitbudgets; der Falllauf erhält 35 Sekunden plus Warmup und angeforderte Messdauer. Ein stark blockierter Software-Renderer kann auch eine kurze dichte Szene daran scheitern lassen; nicht automatisch Auflösung oder Qualität reduzieren.

Die API-Aufrufe messen synchrone UI-Arbeit, **keine echten Pointerereignisse, Eventqueue-Latenz oder Eingabe-bis-sichtbares-Bild-Zeit**. Automatisierung und Diagnose haben selbst Aufwand. Software-/Headless-Befunde und kurze synthetische Szenen ersetzen weder den auffälligen Nutzer-Spielstand noch Mobil-/Thermik-/Firefox-Abnahme. Einzelne kalte/warm geladene Fälle sind keine belastbare A/B-Leistungszusage. Nächste Messentscheidungen und Vergleichsanforderungen bleiben im [Performance-Issue](issues/performance/README.md#messplan-und-erfolgskriterien).

Gezielte CPU-Verträge (kein Browser oder KI-/Simulations-Langlauf):

```bash
node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-diagnostic-capture.check.cjs tests/ashes-of-meridian-diagnostics.check.cjs tests/ashes-of-meridian-scene-capture.check.cjs tests/ashes-of-meridian-browser-harness.check.cjs
```

Der Runner gehört nicht zur CI oder Standard-Testausführung. Agenten verwenden ihn nur für eine konkrete technische Frage mit begrenztem Umfang; mehrminütige/breite Messläufe benötigen weiterhin eine aktuelle ausdrückliche Freigabe. Die [Prüfregeln](testing.md#prüfwahl) bleiben unverändert.
