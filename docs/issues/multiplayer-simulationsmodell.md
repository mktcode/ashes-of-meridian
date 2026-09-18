# Multiplayer: Simulation auf mehrere Parteien öffnen

Abhängig von [Multiplayer: Spielrahmen](multiplayer-rahmen.md).

- [ ] Binäre Verträge (`TeamId`, `PlayerTeam`, Zweier-Tupel für Konten/Sicht, `faction`/`enemy`) durch eine Liste von Parteien und Controllern ersetzen.
- [ ] Feindschaft/Allianzen ausdrücklich modellieren; Kampf, Heilung, Sicht, Fähigkeiten und KI nicht mehr aus `team === 0/1` ableiten.
- [ ] Startaufstellung, Fraktion, Vorteile, Statistik und Gefechtsergebnis je Partei führen.
- [ ] Deterministische Befehls- und RNG-Grenzen für Replay/Netzwerk festlegen und mit 2–4 Parteien prüfen.

Die gemeinsame Aktionslogik ist eine gute Basis. Aktuell sind aber Simulation, Sicht, Ergebnis und Statistik durchgehend auf genau Spieler 0 gegen Gegner 1 zugeschnitten.
