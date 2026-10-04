# Teststrategie: offene Folgearbeit

[Prüfverfahren/Zeitbudget](../testing.md) sind maßgeblich. Kein automatischer Mess-/Umbauauftrag; keine geteilten mutablen VM-Kontexte als Laufzeitabkürzung.

## Vorrang: fachlich veraltete Startannahmen

- [ ] Etablierte HQ-Fixtures und Gefechtsreferenzen gegen den [Worker-Start](../gameplay.md#gefecht-und-fortschritt) prüfen. Statischer Abgleich auf `937914e`: Der Helper `battle()` in [den KI-Prüfungen](../../tests/ashes-of-meridian-ai.check.cjs) ruft nur `g.start()` auf; bereits der Fall `scouting and scans visit unexplored candidate corners…` greift anschließend auf `own(..., 'hq')[0]` zu. [Der aktuelle Start](../../src/simulation/game.ts) setzt dagegen Landungsworker und `deploymentPending`, kein fertiges HQ. Das ist ein konkreter Fixture-Widerspruch, kein neu ausgeführtes Testergebnis. Auch Annahmen über feste Eckstarts fachlich prüfen.
- [ ] Etablierte Basen in Fachtests ausdrücklich aufbauen; echte Deploymentprüfungen müssen den bezahlten Worker→HQ-Ablauf beobachten. Tutorial- und gezielte FFA-Verträge decken Teile des Starts bereits ab. Die alten KI-/Simulationsblöcke sind kein aktueller Abschlussnachweis. Referenzen nicht allein zum Grünmachen regenerieren; Ausführung und Referenzpflege separat freigeben lassen. Abhängige [FFA-Prüfungen](mehrparteien-simulation.md) und [Startabnahme](procedural-battlefields.md) erst auf passenden Fixtures bewerten.
- [ ] Historische Effektfixtures in `presentation-v1.json` von der entfernten unkomponierten Desert-Geografie entkoppeln; aktuelle Helper laden das prozedurale Rezept. RNG-Referenzen bleiben unverändert. Diese Fälle wurden für den Terrainumbau nicht als Abschlussnachweis ausgeführt.

## Steuerungsfixtures

- [ ] Zwei bereits auf Ausgangscommit `b36f4d6` reproduzierte Fehler in `ashes-of-meridian-controls.check.cjs` prüfen: `each battle start resets…` ruft `event('start')` ohne Payload auf und scheitert beim Zugriff auf `restored`; `best expedition depth unlocks…` erwartet nach Fraktionswahl 1, erhält 0. Gegenprobe isoliert mit Build und nur diesen beiden Fällen; nicht durch die Rechteckauswahl verursacht.

## Prüfkosten und Abdeckung bei fachlicher Pflege

- [ ] Laufzeiten nach Build/Datei/Szenario erst aus vorhandenen Ergebnissen erfassen; neue breite Messung freigeben lassen. Konkreter Auswahlhinweis aus der Shaderprüfung auf `937914e`: `map switches keep only current world meshes…` in der Rendererdatei brauchte lokal rund 45 s, die meisten dortigen Shader-/Orchestrierungsfälle nur Millisekunden. Für solche Kleinständerungen Namensfilter statt ungeprüft die ganze Datei wählen. Terrain-/Residenzabdeckung nicht allein wegen Dauer löschen oder Concurrency/Heap blind ändern.
- [ ] Gemischte Testdateien bei fachlicher Pflege trennen; kurze Validatoren ohne doppelte Abdeckung von autonomen Partien separieren.
- [ ] Shader-Stringtests auf relevante Verdrahtung statt Formelschreibweise begrenzen; keine behauptete GLSL-Kompilierung.
- [ ] Modell-/Präsentationsüberschneidungen nach Vertragsvergleich reduzieren; Bounds/Winding/Varianten/RNG können unabhängig schützen.
