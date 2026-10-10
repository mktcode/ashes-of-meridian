# Teststrategie: offene Folgearbeit

[Prüfverfahren/Zeitbudget](../testing.md) sind maßgeblich. Kein automatischer Mess-/Umbauauftrag; keine geteilten mutablen VM-Kontexte als Laufzeitabkürzung.

## Vorrang: fachlich veraltete Startannahmen

- [ ] Etablierte HQ-Fixtures und Gefechtsreferenzen gegen den [Worker-Start](../gameplay.md#gefecht-und-fortschritt) prüfen. Statischer Abgleich auf `937914e`: Der Helper `battle()` in [den KI-Prüfungen](../../tests/ashes-of-meridian-ai.check.cjs) ruft nur `g.start()` auf; bereits der Fall `scouting and scans visit unexplored candidate corners…` greift anschließend auf `own(..., 'hq')[0]` zu. [Der aktuelle Start](../../src/simulation/game.ts) setzt dagegen Landungsworker und `deploymentPending`, kein fertiges HQ. Das ist ein konkreter Fixture-Widerspruch, kein neu ausgeführtes Testergebnis. Auch Annahmen über feste Eckstarts fachlich prüfen.
- [ ] Etablierte Basen in Fachtests ausdrücklich aufbauen; echte Deploymentprüfungen müssen den bezahlten Worker→HQ-Ablauf beobachten. Tutorial- und gezielte FFA-Verträge decken Teile des Starts bereits ab. Die alten KI-/Simulationsblöcke sind kein aktueller Abschlussnachweis. Referenzen nicht allein zum Grünmachen regenerieren; Ausführung und Referenzpflege separat freigeben lassen. Abhängige [FFA-Prüfungen](mehrparteien-simulation.md) und [Startabnahme](procedural-battlefields.md) erst auf passenden Fixtures bewerten.
- [ ] Historische Effektfixtures in `presentation-v1.json` von der entfernten unkomponierten Desert-Geografie entkoppeln; aktuelle Helper laden das prozedurale Rezept. RNG-Referenzen bleiben unverändert. Diese Fälle wurden für den Terrainumbau nicht als Abschlussnachweis ausgeführt.

## Vorrang: reproduzierbare Standardtests

- [ ] Den Playlist-Fall in [den Harness-Prüfungen](../../tests/ashes-of-meridian-harness.check.cjs) von nicht versionierten Musikentwürfen entkoppeln. Auf `8a69e7f` scheitert der gezielte Fall `battle playlist starts after ten seconds…` nach erfolgreichem Build mit `ENOENT` für `music-drafts/06-sporewake.mp3`; auch `07-rootmind.mp3` wird gelesen. Der Harness gehört zur Standardauswahl. Ein frischer Checkout muss ohne lokale Produktionsentwürfe prüfbar sein; keine Ersatzaufnahme erzeugen oder den Wiedergabetest überspringen.
- [ ] Laufzeitverträge (Playlist, Startverzögerung, Pausen und lokale Aufnahmen) von Import-/Freigabenachweisen trennen. Falls unveränderte Aufnahmen dauerhaft zu schützen sind, versionierte Prüfsummen statt zusätzlicher lokaler Kopien erwägen. Keine Neucodierung oder Änderung der Musik durch die Testpflege.

## Prüfkosten und Abdeckung bei fachlicher Pflege

- [ ] Laufzeiten nach Build/Datei/Szenario erst aus vorhandenen Ergebnissen erfassen; neue breite Messung freigeben lassen. Konkreter Auswahlhinweis aus der Shaderprüfung auf `937914e`: `map switches keep only current world meshes…` in der Rendererdatei brauchte lokal rund 45 s, die meisten dortigen Shader-/Orchestrierungsfälle nur Millisekunden. Für solche Kleinständerungen Namensfilter statt ungeprüft die ganze Datei wählen. Terrain-/Residenzabdeckung nicht allein wegen Dauer löschen oder Concurrency/Heap blind ändern.
- [ ] Gemischte Testdateien bei fachlicher Pflege trennen; kurze Validatoren ohne doppelte Abdeckung von autonomen Partien separieren.
- [ ] Shader-Stringtests auf relevante Verdrahtung statt Formelschreibweise begrenzen; keine behauptete GLSL-Kompilierung. Konkrete Beispiele in [den Renderer-Prüfungen](../../tests/ashes-of-meridian-renderer.check.cjs): exakte Triplanar-/Tilt-Shift-Ausdrücke und lokale Licht-/Reliefformeln binden gleichwertige Implementierungen unnötig an Schreibweise und Konstanten.
- [ ] Historische Entfernungsprüfungen gegen aktuelle Fachverträge abgleichen: etwa explizites `aurelion`-Verbot in Controls oder alte Deck-/Ramp-Modellnamen in Terrain. Aktuellen Kartenkatalog und spielbare Geometrie prüfen, nicht jede frühere Entfernung konservieren. Sicherheitsrelevante Negativfälle gegen doppelte Auszahlung, fremde Kontrolle, Sichtlecks oder ungültige Saves erhalten.
- [ ] Modell-/Präsentationsüberschneidungen nach Vertragsvergleich reduzieren; Bounds/Winding/Varianten/RNG können unabhängig schützen.

## Wiederverwendbare Browser- und Diagnosewerkzeuge

- [ ] Gemeinsamen, gezielt aufrufbaren Browser-Harness aus wiederkehrenden `.tmp/`-Checks ableiten: Chromium-Suche/`CHROMIUM_PATH`, frisches isoliertes Profil, `file://`, Fehlererfassung, korrekte Timeouts und Freigabe im Fehlerfall. Keine gelockerte Browsersicherheit oder automatischen Vollsuiten; Software-WebGL ist kein Zielgerätenachweis. Scratch-Pfade sind nur lokale Auditbelege, keine dauerhaft benötigten Eingaben.
- [ ] Aus `.tmp/worker-road-integration/shader-check.mjs` einen kleinen echten WebGL-/Shader-Smokecheck ableiten. Aus `.tmp/dp/check.mjs` die Diagnose-Start-/Stoppprüfung samt Ressourcenfreigabe und aus `.tmp/vao-batches/browser-check.mjs` die technischen VAO-Besitz-/Freigabeprüfungen auf dauerhafte Regressionseignung prüfen. Optimierungsvergleich gegen eine alte Implementierung nicht ungeprüft dauerhaft übernehmen.
- [ ] `.tmp/grid-analysis/probe.cjs` und `.tmp/grid-optimization/probe.cjs` zu einem begrenzten, parametrisierbaren Placement-Benchmark mit JSON-Ausgabe zusammenführen, sofern weiterer Messbedarf besteht. Ergebnisse brauchen Build-/Umgebungskontext; keine zeitabhängigen Pass-/Fail-Grenzen für normale Logiktests. Leistungsziele bleiben unter [Performance](performance/README.md), Capture-Werkzeuge unter [Releasepflege](release-tooling.md).
