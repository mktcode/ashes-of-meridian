# Teststrategie: verbleibende Mess- und Strukturfragen

Bereichsauswahl und Pflegeverfahren: [Prüfungen](../testing.md#befehle-und-auswahl). Die Standardintegration bleibt breit; Bereichsläufe erlauben gezielte Änderungen ohne automatische Terrain-/Modellprüfung. Langzeit-KI und Simulation bleiben gesondert freigabepflichtig.

## Offene Folgeentscheidungen

- Laufzeiten getrennt nach Build, Datei und Szenario erfassen, bevor die Standardabdeckung reduziert oder Heaplimit/Concurrency verändert wird. Terrain-Sweeps schützen unterschiedliche prozedurale Risiken und dürfen nicht allein wegen ihrer Laufzeit gelöscht werden. Repräsentative Varianten und Fehlerseeds erhalten; optionalen Langlauf-Messbedarf gesondert freigeben lassen.
- Große gemischte Controls-/Presentation-/Simulation-Dateien bei fachlichen Umbauten weiter teilen. Kurze Validatoren dürfen in Standardgruppen wandern, sofern ihre Abdeckung nicht bereits anderswo besteht; keine autonomen Partien in schnelle Gruppen aufnehmen. Weitere kurze Verträge in optionalen Dateien zunächst nur lesen/abgleichen.
- GLSL-Stringprüfungen bei konkreter Shaderpflege auf relevante Interface-/Ressourcenverdrahtung begrenzen. Formel-Schreibweise ist keine Kompilierungs- oder GPU-Abnahme; kein routinemäßiger Ersatz durch Screenshotserien.
- Überlappende Modell-/Präsentationsprüfungen nur nach Vertragsvergleich reduzieren. Winding, Worker-Hülle, Budget, Team-/Bauvarianten und RNG-Isolation können trotz ähnlicher Szenarien unabhängige Schutzwirkung besitzen. Keine Referenzneuerzeugung zum Grünmachen.

Kein neuer Implementierungs-/Messauftrag aus diesem Issue. Quellen-/Bytecodecaching im Harness bleibt pro Testprozess; keine geteilten mutablen VM-/Spielzustände als Laufzeitabkürzung.
