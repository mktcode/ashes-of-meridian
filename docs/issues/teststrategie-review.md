# Teststrategie: offene Folgearbeit

[Prüfverfahren/Zeitbudget](../testing.md) sind maßgeblich.

- [ ] Laufzeiten nach Build/Datei/Szenario erst aus vorhandenen Ergebnissen erfassen; neue breite Messung freigeben lassen. Danach gezielte Auswahl verbessern, nicht Terrain-Sweeps allein wegen Dauer löschen oder Concurrency/Heap blind ändern.
- [ ] Gemischte Testdateien bei fachlicher Pflege trennen; kurze Validatoren ohne doppelte Abdeckung von autonomen Partien separieren.
- [ ] Shader-Stringtests auf relevante Verdrahtung statt Formelschreibweise begrenzen; keine behauptete GLSL-Kompilierung.
- [ ] Modell-/Präsentationsüberschneidungen nach Vertragsvergleich reduzieren; Bounds/Winding/Varianten/RNG können unabhängig schützen.

- [ ] Übrige etablierte HQ-Fixtures und Gefechtsreferenzen gegen den neuen [Worker-Start](../gameplay.md#gefecht-und-fortschritt) prüfen. Tutorial- und gezielte FFA-Verträge decken den Start bereits ab; die KI-/Simulationsblöcke wurden dafür nicht ausgeführt. Etablierte Basen in Fachtests ausdrücklich aufbauen, Referenzen nicht allein zum Grünmachen regenerieren. Breite Ausführung und Referenzpflege separat freigeben lassen.

Kein automatischer Mess-/Umbauauftrag; keine geteilten mutablen VM-Kontexte als Laufzeitabkürzung.
