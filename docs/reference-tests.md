# Feste Testreferenzen

Terrain-, Modell-, Zeichen-, Effekt- und RNG-Erwartungen schützen vor unbeabsichtigten Änderungen, nicht vor bewusst geänderten Spielregeln. Sollwerte nicht zur Reparatur fehlgeschlagener Tests neu erzeugen.

- 16 feste Seed-/Biom-Paare prüfen Terrain, Platzierungen, Navigation und Sichtbarkeit; sie sind unabhängige Testdaten, keine Spielmissionen. `tests/fixtures/presentation-v1.json` stammt aus der Charakterisierung vor der Welt-/Effektentkopplung (`97bfda6`).
- `tests/helpers/populated-battle.cjs` stellt ausdrücklich eine ausgebaute Basis für Produktions-/Reparatur-/Crowd- und historische Effekttests bereit, unabhängig vom HQ-only-Spielstart und ohne den Test-RNG weiterzuschalten. Das ist kein ausgelieferter Startmodus. Eigene Starttests prüfen HQ-only, 250/0 Ressourcen ohne passives Einkommen, exakt fünf fraktionsunabhängig gleich teure Worker, die erste Produktion, Abbau und den ersten Neubau für alle Fraktionen.
- Fünf Effektfälle in `tests/helpers/presentation-scenario.cjs` setzen ihren RNG-Einstieg ausdrücklich auf `seeded(1486)` nach 104 Samples. Ihre Hashes und Folgesamples bleiben so unabhängig vom aktuellen Startaufgebot vergleichbar. Der Heil-Emitter wird ausdrücklich an der historischen Position erzeugt, unabhängig von der separat getesteten Spawn-Kollisionsprüfung.
- Der historische kombinierte Waffen-/Avatar-Fixture-Eintrag wird nicht mehr geprüft und nicht durch neue Sollwerte ersetzt. Reguläre Waffen und Fraktionsschaden werden separat in der Simulation geprüft. Alte Gesamtspielstand-Hashes sind kein aktueller Vertrag.
- `tests/fixtures/effects-view-v1.json` charakterisiert reine Zeichenaufrufe aus `b9f0026`, keine GPU-Pixel. Mathematik-/RNG-Tests enthalten feste und unabhängig nachvollziehbare Erwartungen einschließlich vorhandener Sonderfälle.
- Neustarttests verwerfen einen gespielten/verlorenen Run und prüfen frischen Zustand, Indizes und Sichtbarkeit. Produktions-/Reparatur-/sechsminütige Verkehrstests laufen ohne Restore-Unterbrechung. Ehemalige Save-Validierungs-/Roundtriptests sind mit dem Feature entfernt; UI-/Profiltests schützen Pause, ausschließlich zwei Ergebnisaktionen und die fehlenden Speicherpfade.
- `tests/helpers/game-scripts.cjs` lädt benannte klassische Skripte aus `index.html` in Dokumentreihenfolge in eine gemeinsame VM. Nur explizit ausgewählte Namen werden ausgeführt; externe URLs, Pfade außerhalb des Projekts, Module und asynchrone Tags sind nicht Teil des Loader-Vertrags.

[Testbefehl und Prüfverfahren](testing.md).
