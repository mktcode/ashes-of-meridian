# Teststrategie: offene Folgearbeit

[Prüfverfahren/Zeitbudget](../testing.md) sind maßgeblich.

- [ ] Laufzeiten nach Build/Datei/Szenario erst aus vorhandenen Ergebnissen erfassen; neue breite Messung freigeben lassen. Danach gezielte Auswahl verbessern, nicht Terrain-Sweeps allein wegen Dauer löschen oder Concurrency/Heap blind ändern.
- [ ] Gemischte Testdateien bei fachlicher Pflege trennen; kurze Validatoren ohne doppelte Abdeckung von autonomen Partien separieren.
- [ ] Shader-Stringtests auf relevante Verdrahtung statt Formelschreibweise begrenzen; keine behauptete GLSL-Kompilierung.
- [ ] Modell-/Präsentationsüberschneidungen nach Vertragsvergleich reduzieren; Bounds/Winding/Varianten/RNG können unabhängig schützen.

Kein automatischer Mess-/Umbauauftrag; keine geteilten mutablen VM-Kontexte als Laufzeitabkürzung.
