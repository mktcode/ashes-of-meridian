# Teststrategie: offene Folgearbeit

[Prüfverfahren/Zeitbudget](../testing.md) sind maßgeblich. Kein automatischer Mess-/Umbauauftrag; keine geteilten mutablen VM-Kontexte als Laufzeitabkürzung.

## Vorrang: fachlich veraltete Startannahmen

- [ ] Verbliebene lokale Terrain-/Start-/Entitätszahlannahmen gegen die aktuellen Weltrezepte und den [Worker-Start](../gameplay.md#gefecht-und-fortschritt) prüfen. Insbesondere direkte Simulationsfälle für `starting alloy levels` und `starting worker levels` beziehen Upgrades noch aus `game.profile.upgrades` statt aus dem aktuellen `BattleOptions.upgrades`-Snapshot. Lokale Regelarenen von tatsächlichen Landschafts-/Startverträgen trennen.
- [ ] Übrige Abstand-/Produktionsregeln mit entwickelten Simulationfixtures gezielt gegenprüfen. Offene Worker-Langläufe stehen unter [Navigation/Liveness](worker-bauwegfindung/issue.md); bestandener zweiminütiger Abbau mit Abstandskontrolle ersetzt keine Kampf- oder Crowd-Abnahme. Flache lokale Regelarenen behaupten keine Abnahme prozeduraler Karten.
- [ ] Etablierte Basen in Fachtests ausdrücklich aufbauen; echte Deploymentprüfungen müssen den bezahlten Worker→HQ-Ablauf beobachten. Tutorial- und gezielte FFA-Verträge decken Teile des Starts bereits ab. Die alten KI-/Simulationsblöcke sind kein aktueller Abschlussnachweis. Referenzen nicht allein zum Grünmachen regenerieren; Ausführung und Referenzpflege separat freigeben lassen. Abhängige [FFA-Prüfungen](mehrparteien-simulation.md) und [Startabnahme](procedural-battlefields.md) erst auf passenden Fixtures bewerten.

## Prüfkosten und Abdeckung bei fachlicher Pflege

- [ ] Laufzeiten nach Build/Datei/Szenario erst aus vorhandenen Ergebnissen erfassen; neue breite Messung freigeben lassen. Konkreter Auswahlhinweis aus der Shaderprüfung auf `937914e`: `map switches keep only current world meshes…` in der Rendererdatei brauchte lokal rund 45 s, die meisten dortigen Shader-/Orchestrierungsfälle nur Millisekunden. Für solche Kleinständerungen Namensfilter statt ungeprüft die ganze Datei wählen. Terrain-/Residenzabdeckung nicht allein wegen Dauer löschen oder Concurrency/Heap blind ändern.
- [ ] Gemischte Testdateien bei fachlicher Pflege trennen; kurze Validatoren ohne doppelte Abdeckung von autonomen Partien separieren.
- [ ] Modell-/Präsentationsüberschneidungen nach Vertragsvergleich reduzieren; Bounds/Winding/Varianten/RNG können unabhängig schützen.

## Wiederverwendbare Browser- und Diagnosewerkzeuge

- [ ] Gemeinsamen, gezielt aufrufbaren Browser-Harness aus wiederkehrenden `.tmp/`-Checks ableiten: Chromium-Suche/`CHROMIUM_PATH`, frisches isoliertes Profil, `file://`, Fehlererfassung, korrekte Timeouts und Freigabe im Fehlerfall. Keine gelockerte Browsersicherheit oder automatischen Vollsuiten; Software-WebGL ist kein Zielgerätenachweis. Scratch-Pfade sind nur lokale Auditbelege, keine dauerhaft benötigten Eingaben.
- [ ] Aus `.tmp/worker-road-integration/shader-check.mjs` einen kleinen echten WebGL-/Shader-Smokecheck ableiten. Aus `.tmp/dp/check.mjs` die Diagnose-Start-/Stoppprüfung samt Ressourcenfreigabe und aus `.tmp/vao-batches/browser-check.mjs` die technischen VAO-Besitz-/Freigabeprüfungen auf dauerhafte Regressionseignung prüfen. Optimierungsvergleich gegen eine alte Implementierung nicht ungeprüft dauerhaft übernehmen.
- [ ] `.tmp/grid-analysis/probe.cjs` und `.tmp/grid-optimization/probe.cjs` zu einem begrenzten, parametrisierbaren Placement-Benchmark mit JSON-Ausgabe zusammenführen, sofern weiterer Messbedarf besteht. Ergebnisse brauchen Build-/Umgebungskontext; keine zeitabhängigen Pass-/Fail-Grenzen für normale Logiktests. Leistungsziele bleiben unter [Performance](performance/README.md), Capture-Werkzeuge unter [Releasepflege](release-tooling.md).
