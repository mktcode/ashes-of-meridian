# Teststrategie: offene Folgearbeit

[Prüfverfahren/Zeitbudget](../testing.md) sind maßgeblich.

- [ ] Laufzeiten nach Build/Datei/Szenario erst aus vorhandenen Ergebnissen erfassen; neue breite Messung freigeben lassen. Danach gezielte Auswahl verbessern, nicht Terrain-Sweeps allein wegen Dauer löschen oder Concurrency/Heap blind ändern.
- [ ] Gemischte Testdateien bei fachlicher Pflege trennen; kurze Validatoren ohne doppelte Abdeckung von autonomen Partien separieren.
- [ ] Shader-Stringtests auf relevante Verdrahtung statt Formelschreibweise begrenzen; keine behauptete GLSL-Kompilierung.
- [ ] Modell-/Präsentationsüberschneidungen nach Vertragsvergleich reduzieren; Bounds/Winding/Varianten/RNG können unabhängig schützen.

- [ ] Übrige etablierte HQ-Fixtures und Gefechtsreferenzen gegen den neuen [Worker-Start](../gameplay.md#gefecht-und-fortschritt) prüfen. Tutorial- und gezielte FFA-Verträge decken den Start bereits ab; die KI-/Simulationsblöcke wurden dafür nicht ausgeführt. Etablierte Basen in Fachtests ausdrücklich aufbauen, Referenzen nicht allein zum Grünmachen regenerieren. Breite Ausführung und Referenzpflege separat freigeben lassen.

- [ ] Historische Effektfixtures in `presentation-v1.json` von der entfernten unkomponierten Desert-Geografie entkoppeln; aktuelle Helper laden das prozedurale Rezept. RNG-Referenzen bleiben unverändert. Diese Fälle wurden für den Terrainumbau nicht als Abschlussnachweis ausgeführt.

- [ ] Renderer-Fixtures für Upland und Beleuchtungsprofile an die aktuellen Profilverträge anbinden: Der gezielte Renderer-Dateilauf scheitert bei `upland weathering` (historische Frontier-Annahme für `u_upland`) und `lighting profiles override` (fehlendes `AURELION_ENTITY_LIGHTING`). Beide Fehler sind auch mit zurückgenommener Kameradrehung reproduzierbar; keine Shader-/Profiländerung zum Grünmachen.

Kein automatischer Mess-/Umbauauftrag; keine geteilten mutablen VM-Kontexte als Laufzeitabkürzung.
