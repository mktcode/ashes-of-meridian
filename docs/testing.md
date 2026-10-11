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

`npm run check:quality` ist das bewusst kurze Qualitätsnetz: begrenztes Linting/Formatprüfung, Repository-Besitz, lokale Dokumentationslinks, strikter Build sowie explizit ausgewählte Buildkennungs-, Linkchecker-, Testauswahl-, Core- und Werkzeugverträge. Die Browser-Harness-Unitfälle verwenden einen Fake, keinen Browser. Es ist keine Spielabnahme und ersetzt keine betroffenen Fachtests. Die GitHub-CI führt denselben Befehl unter der Node-Version aus `.nvmrc` nach `npm ci` aus; keine KI-/Simulations-, echten Browser- oder Vollsuiten.

`npm run check:docs` prüft ohne Build oder Netzwerk die lokalen Datei-/Verzeichnisziele von Inline-Links, Bildern und Referenzdefinitionen in `README.md`, `AGENTS.md` und allen Markdown-Dateien unter `docs/`. Code und Kommentare bleiben außen vor; URL-Fragmente und Queryteile werden abgetrennt, Anker nicht validiert. Unterstützt werden einfache Markdown-Ziele oder `<Ziele mit Leerzeichen>`, kein vollständiger Markdown-/HTML-Parser. Bei neuen komplexen Linkformen zuerst den Checker gezielt erweitern.

Tests laden gebaute klassische Skripte. Einmal bauen, dann kleinste passende Datei oder Fälle wählen:

```bash
npm run build
node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-persistence.check.cjs
node --max-old-space-size=128 --test --test-concurrency=1 --test-name-pattern='profile defaults' tests/ashes-of-meridian-persistence.check.cjs
```

Dateien/Namen mit `rg 'test\(' tests` suchen; übersprungene Tests sind keine bestandenen. Namensfilter verhindern nicht unbedingt Dateiaufbau. Nach Build einen neuen Testprozess starten: VM-Kontexte bleiben je Fall isoliert, Harness-Caching ist kein geteilter Spielzustand.

`node scripts/run-tests.mjs <bereich> --list` zeigt Auswahl ohne Build/Lauf. Bereiche: `logic`, `terrain`, `presentation`, `models`, `standard`. `npm run test:logic`, `test:terrain`, `test:presentation` und `test:models` bauen jeweils neu; Gruppen sind keine Zeitgarantie. `npm test` baut und führt die Standardauswahl ohne die beiden optionalen Langblöcke aus, kann dennoch mehrere Minuten dauern. `npm test -- …` ersetzt keinen gezielten Dateilauf.

`npm run test:ai` und `npm run test:simulation` nur im ausdrücklich freigegebenen Umfang. Eine Freigabe für einen Fall erlaubt weder ganze Datei noch anderen Block. Die [Start-Upgrade-Verträge](../tests/ashes-of-meridian-start-upgrades.check.cjs) liegen getrennt von etablierten Basen und Worker-Langläufen, bleiben aber Teil der optionalen Simulationauswahl: viele echte Kartenstarts kosten lokal etwa fünf Minuten. Sie prüfen `BattleOptions.benefits` für Start-Cinder und Zusatzworker, die Kombination mit `BattleOptions.upgrades`, Snapshot-Isolation, Reserven für das bezahlte HQ, Bonus-/Landeworker, Abstände und RNG; nicht HQ-Bauabschluss oder Worker-Liveness.

## Schlanke Werkzeugkonventionen

`.editorconfig` gibt UTF-8, LF und grundlegende Einrückung vor. `npm run lint`, `npm run check:format` und das ausdrücklich schreibende `npm run format` bearbeiten ausschließlich die Liste in [tooling-files.json](../scripts/tooling-files.json): neue Hygiene-/Browserwerkzeuge und zugehörige Fixtures sowie Dokumentationschecker/Test-Runner. ESLint prüft empfohlene Fehlerregeln mit Node-/gezielten Browserglobals; Prettier vereinheitlicht diesen kleinen Bereich. Keine globale Neuformatierung, keine Modulmigration der klassischen Spielskripte. Neue Dateien gezielt aufnehmen; mechanische Pflege bestehender Dateien von Vertragsänderungen getrennt committen. Für Spielquellen bleibt der strikte TypeScript-Build maßgeblich.

`npm run check:repository` erkennt eingecheckte `.tmp/`, `dist/` und `node_modules/`, prüft deren Ignore-Regeln und lehnt Symlinks an diesen schreibenden Worktree-Wurzeln ab. Es löscht nichts und ordnet keine fremden Backups ihrem Besitzer zu. Eigene Scratch-Verzeichnisse nur eindeutig zugeordnet bereinigen; vorhandene Patches, Saves und Capture-Belege erhalten. Absichtlich ausgelieferte Assets unter `release/` sind kein generierter Scratch.

## Technischer Browser-Smokecheck

`npm run check:browser` baut und öffnet `index.html` direkt über `file://` in einem frischen headless Chromium-Profil. Ein installiertes Chromium ist nötig, optional über `CHROMIUM_PATH` (ein gesetzter ungültiger Pfad wird nicht still ersetzt). Kein Download, Server oder gelockerter Sandbox-/Dateizugriff. Start und Prüfteil haben jeweils 30 Sekunden Budget; Profile/Scratch liegen nur in einem eigenen temporären Worktree-Verzeichnis und werden auch bei Fehlern freigegeben.

Der Check wartet auf eine gerenderte Startansicht, lehnt JavaScript-/Konsolenfehler ab, prüft die tatsächlich angelegten Shaderprogramme auf erfolgreiches Linking und den GL-Fehlerzustand. Er erzwingt Kontextverlust und verlangt gestopptes Rendering sowie sichtbare Recovery-UI. Das ist ein echter GLSL-/`file://`-/Lebenszyklusnachweis, aber kein Pixelbildvergleich, Leckfreiheitsbeweis, Gefechts-/Pickingtest oder Zielgeräteperformancebeleg. Szenen-/Marketing-Capture und Diagnoserunner verwenden ebenfalls diesen Browser-Harness; Bild-Batches teilen einen Browser, Echtzeit-Diagnosefälle bleiben isoliert.

`npm run check:map-viewer` ist ein separater, ausdrücklich gestarteter technischer Check: `file://`-Launcher, kein Profilzugriff, Kamera trotz stehender Simulation, Maus und emuliertes Pinch/Drehen, erweiterter Zoom, kein Idle-Neuzeichnen, exportierte Projektionsgeometrie, Resize/Gesamtansicht und Seedwechsel. Ein isolierter Browser mit begrenztem Zeitbudget; keine Screenshotserie oder KI-Partie. Die freien Projektionen/Fitmathematik haben zusätzlich kurze CPU-Verträge unter `tests/ashes-of-meridian-capture.check.cjs` und gezielten Rendererfällen. Touchkomfort und Bildqualität bleiben Echtgeräte-/menschliche Abnahme.

## Testpflege und Aussagegrenzen

Automatisierung schützt aktuelle Logik, Zustands-/Ressourcen-/Ladeverträge und RNG, nicht UI-Wortlaut, vollständiges Markup oder historische Entfernungen. Keine Tests gegen archivierte Implementierungskopien oder auf die Abwesenheit früherer Karten, Modelle und Bedienelemente. Erwartungen aus dem aktuellen Fachvertrag ableiten; ungültige Eingaben mit neutralen Testwerten statt früheren Inhaltsnamen prüfen. Negative Tests brauchen aktuellen Fachgrund, etwa keine doppelte Auszahlung oder verborgenen Feinddaten. Abdeckung klein und unabhängig halten; [feste Referenzen](reference-tests.md) schützen aktuelle Verträge und sind keine GPU-Pixelbilder.

Node führt kein GLSL aus. [Shader-Verträge](../tests/ashes-of-meridian-shader-contracts.check.cjs) prüfen Schnittstellen und ausgewählte Verdrahtung, nicht exakte Farb-/Glanzformeln oder Bildqualität. Browserchecks nutzen aktuellen Build, isoliertes Profil und `file://` ohne Sicherheitslockerungen. Nur fragliche Lade-/Shader-/Picking-/Lebenszykluspfade prüfen. Software-WebGL und emuliertes Touch bestätigen keine Echtgeräteperformance; KI-Partien kein menschliches Balancing.

**Visuelle, akustische und vollständige Spielabnahme bleibt menschlich.** Abschluss nennt tatsächliche Prüfungen und relevante offene Grenzen, keine behauptete Vollabnahme. Dauerhafte offene Befunde ins passende Issue, keine Testzählhistorie oder zusätzliches Worklog.

## Lokale Performancediagnose

`index.html?diagnostics=1` aktiviert lokale Aufzeichnung; **Export diagnostic JSON** lädt den Bericht, **Stop recording** beendet nur die Messung. Ohne Parameter keine Messhüllen, Timer, Kontextzählungen oder Diagnose-DOM. Export bleibt nach behandeltem Kontextverlust erreichbar, solange die Seite bedienbar ist. Keine Telemetrie/automatische Sicherung; Reload kann Daten verlieren.

Schema 3 trägt die [Buildkennung](architecture.md#auslieferung) mit vollständigem Payload-Fingerabdruck und Git-Provenienz; die Kurzkennung und GPU-Timer-Verfügbarkeit sind an den Diagnoseknöpfen sichtbar. `window.Meridian.build` ist auch ohne Aufzeichnung lesbar. Fehlende Git-Provenienz bedeutet `null`, nicht einen angenommenen sauberen Stand. Vorher/Nachher anhand von Buildkennung und Messkontext zuordnen, nicht nur anhand der unveränderten Runtime-Versionsnummer.

Der begrenzte Ausschnitt enthält CPU-Phasen, Callback-/Renderintervalle, optional asynchrone GPU-Passzeiten und Ressourcen-/Uploadschätzungen. `cpuDetails` ergänzt je Callback und in der Zusammenfassung: exklusive Unterphasendauer (`ms`) und Aufrufzahl (`calls`), nach der tatsächlich aktiven Hauptphase getrennt. Bewegung, Körperprüfung/Yield, Wegvorbereitung/-suche, Siedlungsverwaltung/Layout/Wachstum, Belegungsaufbau, Sicht, Kampfhash und KI werden getrennt erfasst. `tick.calls` zählt feste Simulationsschritte; UI trennt HUD, Gefechtssicherung und Snapshot, Szenenaufbau Welt/Fog, Straßen, Gebäudeboden, Entitäten, Effekte und Hilfsmasken. Die GL-Einreichung trennt zusätzlich Instanzuploads, Batch-Zeicheneinreichung und Modellkacheln.

Verschachtelte Arbeit wird nicht doppelt gezählt: beispielsweise schließt Bewegung gemessene Körperprüfungen und Wegsuche aus, eine Sicherung den Snapshot. Unterphasen sind Teil von `cpuMs`, nicht zusätzlich zu addieren; unzugeordneter Rest und Messaufwand bleiben möglich. Aufrufzahlen sind Methodenaufrufe, keine Einheitenzahlen. Detail-Zusammenfassungen zählen eine gemessene Hauptphase ohne entsprechenden Aufruf als 0 ms und 0 Aufrufe, ausgelassene Hauptphasen dagegen nicht als Probe. Ohne Aufruf fehlt der Detail-Eintrag im einzelnen Callback.

CPU-Unterphasen messen nur synchrone Arbeit innerhalb aufgezeichneter rAF-Phasen. Zusätzlich hält `recording.interactions` höchstens 512 abgeschlossene synchrone UI-Wurzelaufrufe außerhalb von rAF: Welt-Pointerrelease, direkte Auswahl/Rechteckauswahl, Befehlsübermittlung, Aktionspanel und Zielanwendung. Ein Pointerrelease enthält Picking und gegebenenfalls Auswahl/Befehl; ein Panelaufruf kann auch nur einen Modus wechseln. Verschachtelte Aufrufe bilden keine weiteren Ereignisse, sondern exklusive `input`-Details, einschließlich synchroner Wegsuche und HUD-Arbeit. Picking trennt Entitätsprojektion (`entityPicking`) von Zielauflösung (`targetPicking`, mit gegebenenfalls Terrain-Ray). Die Wurzeldauer ist inklusiv: Details weder dazu addieren noch mit Frame-CPU vermischen. Aufrufe während rAF bleiben in ihrer aktiven Framephase. Summaries sind je Wurzelart getrennt, fehlende Detailaufrufe innerhalb dieser Art zählen als 0 ms und 0 Aufrufe. Fehler markieren abgeschlossene Aufrufe, Abbruch/Stopp verwirft unvollständige Arbeit.

Ereigniszeitpunkte und Frames teilen den Ursprung der ersten Messung. Eingabewartezeit vor Handlerbeginn, asynchrone Fortsetzungen und erstes sichtbar präsentiertes Bild werden nicht gemessen; auch Hover-/Move-/Wheel-Handler, Laden und Idle-Arbeit bleiben außerhalb dieser Auswahl. Ein Ereignis zählt einen Wurzelaufruf, nicht automatisch einen Klick oder erfolgreich ausgeführten Befehl. Argumente, Befehlsziele, ausgewählte IDs und Fehlertexte werden nicht exportiert.

Szenenkontext und Ressourcen werden nach gerenderten Frames höchstens einmal pro Sekunde gesampelt, mit höchstens 120 Einträgen. Der Kontext nennt lebende Einheiten insgesamt, eigene Einheiten inklusive Worker und eigenes Militär ohne Worker; außerhalb des aktiven Gefechts sind Armee-, Auswahl- und Kamerawerte unbekannt statt ein alter Bestand. Aktive Kamera, Auswahlgröße, Pause, Tempo, Karte/Seed, Simulationszeit und tatsächliche Renderer-Tagesstunde erlauben die Zuordnung von Tag/Nacht und unterschiedlichen Bildausschnitten. Interaktionen erfassen ihren Kontext vor dem Wurzelaufruf samt interner Auflösung, Qualität und DPR; Ressourcensamples ergänzen CSS-Viewport und MSAA. Zählungen/Kontexterfassung gehören zum Messaufwand, nicht zum regulären Spielpfad.

Diagnosehüllen gehören ausschließlich den beteiligten Instanzen, folgen dem Austausch der Gefechtswelt auch vor Eingabearbeit und werden beim Stopp entfernt; spätere Methodenbesitzer werden nicht überschrieben. Keine Änderungen an Simulationsprototypen, Spielständen oder RNG. Häufige Methodenaufrufe erhöhen den Messaufwand; keine neuen Timer pro Wegsuchnachbar, Modellteil oder GL-Operation.

Fehlende/disjoint GPU-Werte sind keine Nullkosten. CPU-Zeiten sind keine Auslastungsprozente, geschätzte Bytes kein Treiberspeicher. Keine Tokens oder vollständigen Spielzustände; Browserkennung und Karte/Seed sind enthalten.

Chromium bleibt vorerst die Basis für CPU-/GPU-Vergleiche. Die Diagnose verwendet `EXT_disjoint_timer_query_webgl2`; fehlende Unterstützung, insbesondere im bisherigen Firefox-Pfad, liefert keine GPU-Zeiten. Browser-/Treiberverfügbarkeit im Bericht prüfen, nicht aus der Browserwahl allein ableiten. Keine gelockerten Browsersicherheitsregeln oder privilegierten Firefox-Erweiterungen für reguläre Messungen voraussetzen.

Für reproduzierbare arrangierte Szenen übernimmt der [Chromium-Diagnose-Runner](diagnostic-capture.md) begrenzte Echtzeitfenster und JSON-Ausgabe auf Basis der Capture-Rezepte. Er trennt Laden/Warmup/Nachlauf von Messframes und berechnet die bestehenden Recorder-Summaries für explizite Frame-/Interaktions-ID-Grenzen neu, ohne Sitzungsdaten zu verändern. Kein Browserclock-Mocking oder automatischer CI-/Langlauf; Software-/unbekannte Grafikbackends werden gekennzeichnet und können als Voraussetzung abgewiesen werden.

Vergleichskontext, Erfolgskriterien und offene Messfragen stehen zentral unter [Performance](issues/performance/README.md#messplan-und-erfolgskriterien).

## Manuelle Probeläufe

Nach Build isoliert ohne normales Profil/Checkpoint:

- `map-viewer.html` für stillstehende Landschaften mit Kameraeingaben, erweitertem Zoom, Gesamtansicht und exportierbarem Capture-Rezept; [Bedienung](scene-capture.md). Keine Zuschauerpartie.
- `index.html?experiment=<karten-id>&seed=<positiver-seed>` für Katalogkarten; IDs im [Katalog](../src/battlefields/catalog.ts). Seed maximal acht Stellen; alle Katalogkarten erzeugen Terrain aus dem Seed.
- `index.html?experiment=height`: prozedurale Mothership-Höhen/Sicht mit zwei Workern.

Vergleichsseeds nur im betroffenen Issue halten. `npm run simulate:visible` ist eine persönliche Zuschauerpartie, **nie automatisch durch Agenten öffnen**. Allgemeine menschliche Abnahme: [vollständige Runs](issues/playtest-validation.md).
