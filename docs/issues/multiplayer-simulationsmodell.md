# Multiplayer-Vorbereitung: Parteien und lokale Tests

Reihenfolge und Grenzen: [Rahmen](multiplayer-rahmen.md). Weitere Umsetzung nach eigenem Go; bestehender Parteienzustand siehe [Architektur](../architecture.md#teamzustand-sicht-und-ki).

- [ ] Parteien-IDs, Zweier-Tupel, Sichtverwaltung, Startvergabe und Aktionen für bis zu vier Parteien öffnen; neutrale Entitäten getrennt halten. Eigentum, Beziehungen und lokale Perspektive nicht gleichsetzen.
- [ ] Bestehende Kampf-/Hilfs- und Ergebnisregeln als Einzelspielregeln abgrenzen; für interne Mehrparteien-Szenarien Beziehungen/Abbruch ausdrücklich vorgeben, keine Koop-/PvP-Regeln erfinden.
- [ ] Lokalen Harness für 2–4 Parteien ergänzen: getrennte Konten/Sicht, zulässige Befehle, KI und reproduzierbare Starts; bisherigen Zwei-Parteien-Verlauf/RNG schützen.

Restgrenzen: `src/contracts.d.ts`, `src/simulation/game.ts`, `src/world.ts` und `src/simulation/runtime.ts` begrenzen Parteien-IDs, Aufstellung, Sicht und Ergebnis auf zwei Parteien. Statistik und Darstellung sind weiter spielerzentriert. Die mechanisch angepassten KI-/Simulations-Testdateien wurden im ersten Paket nur auf Syntax geprüft; ihre Ausführung benötigt gesonderte Freigabe.

Prüfung bei Umsetzung: Build, gezielte Regressionen und abschließend `npm test`; KI-/Simulations-Testblöcke auch auszugsweise nur nach gesonderter aktueller Freigabe. Keine Referenzwerte zur Anpassung an neues Verhalten regenerieren.
