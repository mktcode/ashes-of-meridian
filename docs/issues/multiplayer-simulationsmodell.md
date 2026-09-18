# Multiplayer-Vorbereitung: Parteien und lokale Tests

Reihenfolge und Grenzen: [Rahmen](multiplayer-rahmen.md). Noch kein Umsetzungs-Go.

- [ ] Erstes Paket: Parteienzustand und Controllerzuordnung zentralisieren; Konten, Fraktionen, Vorteile und Sicht nicht mehr als Spieler/Gegner-Sonderfälle verwalten. Einzelspiel startet weiterhin unverändert mit zwei Parteien.
- [ ] Anschließend Startvergabe, KI-Durchlauf und Aktionen für bis zu vier Parteien öffnen; neutrale Entitäten getrennt halten. Eigentum, Beziehungen und lokale Perspektive nicht gleichsetzen.
- [ ] Bestehende Kampf-/Hilfs- und Ergebnisregeln als Einzelspielregeln abgrenzen; für interne Mehrparteien-Szenarien Beziehungen/Abbruch ausdrücklich vorgeben, keine Koop-/PvP-Regeln erfinden.
- [ ] Lokalen Harness für 2–4 Parteien ergänzen: getrennte Konten/Sicht, zulässige Befehle, KI und reproduzierbare Starts; bisherigen Zwei-Parteien-Verlauf/RNG schützen.

Codebefund: `src/contracts.d.ts`, `src/simulation/game.ts`, `src/world.ts` und `src/simulation/runtime.ts` begrenzen Typen, Konten, Sicht, Starts und KI-Durchlauf auf zwei Parteien. Gemeinsame Aktionen nehmen bereits eine Partei entgegen; Ergebnis, Statistik und Metaupgrades sind noch spielerzentriert.

Prüfung bei Umsetzung: Build, gezielte Regressionen und abschließend `npm test`; KI-/Simulations-Testblöcke auch auszugsweise nur nach gesonderter aktueller Freigabe. Keine Referenzwerte zur Anpassung an neues Verhalten regenerieren.
