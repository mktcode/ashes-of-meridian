# Prüfungen

**Zeit ist ein Budget.** Kurze gezielte Rückkopplung ist Standard; Prüfungen müssen eine konkrete Risiko-/Fehlerfrage beantworten. Keine vorsorglichen Vollläufe, Kreuzprodukte oder Screenshotserien.

## Prüfwahl

| Änderung | Kleinster sinnvoller Nachweis |
| --- | --- |
| Dokumentation | Diff, betroffene Angaben/Links; kein Build oder Spieltest |
| Text, Layout oder mechanische Code-Kleinständerung | Diff und bei Quellcode Build; keine dauerhaften Text-/CSS-Sollbilder |
| Lokale Logik | Build und betroffene Datei/Fälle; relevante Fehlerregression |
| Gemeinsame Simulation/RNG/Ladeverträge | Betroffene Nutzer prüfen; breite Suite nur bei nicht sinnvoll eingrenzbarem Risiko |
| Rendering/Eingabe/Auslieferung | Betroffene technische Verträge; Browserdiagnose nur für konkrete offene Frage |

Vor dem Lauf Umfang und erwartete Dauer abschätzen. **Mehrminütige oder zeitlich unbekannte breite Läufe nur nach aktueller ausdrücklicher Freigabe**, mit benanntem Erkenntnisziel. Umfangreiche KI-/Simulationsblöcke bleiben unabhängig von Filter/Laufzeit immer freigabepflichtig, auch direkte Node-Aufrufe daraus. Ein Implementierungsauftrag ist keine solche Freigabe.

Breite Abschlussprüfung ist keine Pflicht bei jedem Commit oder jeder Integration. Wenn erforderlich und freigegeben, führt nur der Hauptagent sie einmal am integrierten Stand aus. Wiederholung braucht neues relevantes Risiko, etwa seitdem geänderte gemeinsame Verträge; keine erneute Suite nach reiner Dokumentations-/Layoutpflege. Bereits vorhandene Ergebnisse nutzen und ihren Stand benennen. Langtests nicht zum Zeitsparen abschwächen oder Sollwerte zum Grünmachen neu erzeugen.

## Befehle und Auswahl

Tests laden gebaute klassische Skripte. Einmal bauen, dann kleinste passende Datei oder Fälle wählen:

```bash
npm run build
node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-persistence.check.cjs
node --max-old-space-size=128 --test --test-concurrency=1 --test-name-pattern='profile defaults' tests/ashes-of-meridian-persistence.check.cjs
```

Dateien/Namen mit `rg 'test\(' tests` suchen; übersprungene Tests sind keine bestandenen. Namensfilter verhindern nicht unbedingt Dateiaufbau. Nach Build einen neuen Testprozess starten: VM-Kontexte bleiben je Fall isoliert, Harness-Caching ist kein geteilter Spielzustand.

`node scripts/run-tests.mjs <bereich> --list` zeigt Auswahl ohne Build/Lauf. Bereiche: `logic`, `terrain`, `presentation`, `models`, `standard`. `npm run test:logic`, `test:terrain`, `test:presentation` und `test:models` bauen jeweils neu; Gruppen sind keine Zeitgarantie. `npm test` baut und führt die Standardauswahl ohne die beiden optionalen Langblöcke aus, kann dennoch mehrere Minuten dauern. `npm test -- …` ersetzt keinen gezielten Dateilauf.

`npm run test:ai` und `npm run test:simulation` nur im ausdrücklich freigegebenen Umfang. Eine Freigabe für einen Fall erlaubt weder ganze Datei noch anderen Block.

## Testpflege und Aussagegrenzen

Automatisierung schützt Logik, Zustands-/Ressourcen-/Ladeverträge und RNG, nicht UI-Wortlaut, vollständiges Markup oder historische Entfernungen. Negative Tests brauchen aktuellen Fachgrund, etwa keine doppelte Auszahlung oder verborgenen Feinddaten. Abdeckung klein und unabhängig halten; [feste Referenzen](reference-tests.md) sind keine GPU-Pixelbilder.

Node führt kein GLSL aus. Browserchecks nutzen aktuellen Build, isoliertes Profil und `file://` ohne Sicherheitslockerungen. Nur fragliche Lade-/Shader-/Picking-/Lebenszykluspfade prüfen. Software-WebGL und emuliertes Touch bestätigen keine Echtgeräteperformance; KI-Partien kein menschliches Balancing.

**Visuelle, akustische und vollständige Spielabnahme bleibt menschlich.** Abschluss nennt tatsächliche Prüfungen und relevante offene Grenzen, keine behauptete Vollabnahme. Dauerhafte offene Befunde ins passende Issue, keine Testzählhistorie oder zusätzliches Worklog.

## Lokale Performancediagnose

`index.html?diagnostics=1` aktiviert lokale Aufzeichnung; **Export diagnostic JSON** lädt den Bericht, **Stop recording** beendet nur die Messung. Ohne Parameter keine Diagnosearbeit. Export bleibt nach behandeltem Kontextverlust erreichbar, solange die Seite bedienbar ist. Keine Telemetrie/automatische Sicherung; Reload kann Daten verlieren.

Der begrenzte Ausschnitt enthält CPU-Phasen, Callback-/Renderintervalle, optional asynchrone GPU-Passzeiten und Ressourcen-/Uploadschätzungen. Schema 2 ergänzt `cpuDetails` je Callback und in der Zusammenfassung: exklusive Unterphasendauer (`ms`) und Aufrufzahl (`calls`), nach der tatsächlich aktiven Hauptphase getrennt. Bewegung, Körperprüfung/Yield, Wegvorbereitung/-suche, Siedlungsverwaltung/Layout/Wachstum, Belegungsaufbau, Sicht, Kampfhash und KI werden getrennt erfasst. `tick.calls` zählt feste Simulationsschritte; UI trennt HUD, Gefechtssicherung und Snapshot, Szenenaufbau Welt/Fog, Straßen, Gebäudeboden, Entitäten, Effekte und Hilfsmasken. Die GL-Einreichung trennt zusätzlich Instanzuploads, Batch-Zeicheneinreichung und Modellkacheln.

Verschachtelte Arbeit wird nicht doppelt gezählt: beispielsweise schließt Bewegung gemessene Körperprüfungen und Wegsuche aus, eine Sicherung den Snapshot. Unterphasen sind Teil von `cpuMs`, nicht zusätzlich zu addieren; unzugeordneter Rest und Messaufwand bleiben möglich. Aufrufzahlen sind Methodenaufrufe, keine Einheitenzahlen. Detail-Zusammenfassungen zählen eine gemessene Hauptphase ohne entsprechenden Aufruf als null, ausgelassene Hauptphasen dagegen nicht als Probe. Ohne Aufruf fehlt der Detail-Eintrag im einzelnen Callback.

CPU-Unterphasen messen nur synchrone Arbeit innerhalb aufgezeichneter rAF-Phasen, nicht Eingabehandler, Laden oder Idle-Arbeit außerhalb rAF. Diagnosehüllen gehören ausschließlich den beteiligten Instanzen, folgen dem Austausch der Gefechtswelt und werden beim Stopp entfernt; keine Änderungen an Simulationsprototypen, Spielständen oder RNG. Häufige Methodenaufrufe erhöhen den Messaufwand; keine Timer pro Wegsuchnachbar, Modellteil oder GL-Operation.

Fehlende/disjoint GPU-Werte sind keine Nullkosten. CPU-Zeiten sind keine Auslastungsprozente, geschätzte Bytes kein Treiberspeicher. Keine Tokens oder vollständigen Spielzustände; Browserkennung und Karte/Seed sind enthalten.

Für Vergleiche denselben Abschnitt/Einstellungen verwenden und getrennt exportieren. Pause, Qualitätswechsel und Hintergrundlücken abgrenzen; Diagnose verursacht selbst Aufwand. Messbedarf und Befunde: [Mobile Performance](issues/mobile-performance.md#messplan-und-abnahme).

## Manuelle Probeläufe

Nach Build isoliert ohne normales Profil/Checkpoint:

- `index.html?experiment=<karten-id>&seed=<positiver-seed>` für Katalogkarten; IDs im [Katalog](../src/battlefields/catalog.ts). Seed maximal acht Stellen; alle Katalogkarten erzeugen Terrain aus dem Seed.
- `index.html?experiment=height`: prozedurale Mothership-Höhen/Sicht mit zwei Workern.

Vergleichsseeds nur im betroffenen Issue halten. `npm run simulate:visible` ist eine persönliche Zuschauerpartie, **nie automatisch durch Agenten öffnen**. Allgemeine menschliche Abnahme: [vollständige Runs](issues/playtest-validation.md).
