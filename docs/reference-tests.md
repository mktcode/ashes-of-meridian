# Referenztests

Feste Terrain-, Modell-, Effekt- und RNG-Erwartungen schützen vor unbeabsichtigten Änderungen. Sie sind keine Verpflichtung zur Rückwärtskompatibilität.

Spielstandtests erzeugen einen Checkpoint aus dem aktuellen Spiel: Befehle, Produktion, Scan und 100 feste Schritte. Geprüft werden Snapshot-Isolation, Restore, Indizes/Sichtbarkeit, Weiterlaufen und ungültige Eingaben.

Das alte Operations-Fixture, sein Fünf-Sekunden-Vergleich und der Adapter für überlagerte Kristallpositionen sind entfernt. Ebenso die sechs historischen Gesamtspielstand-Hashes innerhalb der Effekt-Fixtures; die eigentlichen Effekt-/RNG-Erwartungen bleiben unverändert.

Nach der Kampagnenentfernung bleiben alle 16 historischen Seed-/Biom-Paare explizite Terrain-Testdaten, nicht Spielmissionen. Layout- und Welt-/Navigationsreferenzen wurden nicht neu erzeugt; der Test-Sichtgeber des entfallenen Allianzteams ist jetzt eine eigene Einheit mit gleicher Sichtweite. Die fünf weiterhin passenden Effektfälle setzen ihren RNG-Einstieg im Test explizit auf den ursprünglichen Zustand (`seeded(1486)`, 104 Samples). So bleiben ihre vorhandenen Hashes und Folgesamples unverändert, unabhängig vom neuen Startaufgebot.

Der kombinierte Waffen-Hash einschließlich des entfernten Avatars wird nicht mehr geprüft; sein historischer Fixture-Eintrag wurde nicht durch neue Sollwerte ersetzt. Ein eigener Simulationstest prüft weiterhin Gewehr-, Panzer-, Fraktionsschaden und Artillerie-Strikes/Effekterzeugung. Entfernte Missions-/Generator-/Sternentests wurden durch Gefechtsziel-, Start-, Gratisupgrade- und neue Checkpoint-Prüfungen ersetzt. [Abgrenzung](campaign-removal.md).

[Testbefehl und Abdeckung](testing.md).
