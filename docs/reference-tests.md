# Referenztests

Feste Terrain-, Modell-, Effekt- und RNG-Erwartungen schützen vor unbeabsichtigten Änderungen. Sie sind keine Verpflichtung zur Rückwärtskompatibilität.

Spielstandtests erzeugen einen Checkpoint aus dem aktuellen Spiel: Befehle, Produktion, Scan und 100 feste Schritte. Geprüft werden Snapshot-Isolation, Restore, Indizes/Sichtbarkeit, Weiterlaufen und ungültige Eingaben.

Das alte Operations-Fixture, sein Fünf-Sekunden-Vergleich und der Adapter für überlagerte Kristallpositionen sind entfernt. Ebenso die sechs historischen Gesamtspielstand-Hashes innerhalb der Effekt-Fixtures; die eigentlichen Effekt-/RNG-Erwartungen bleiben unverändert.

[Testbefehl und Abdeckung](testing.md).
