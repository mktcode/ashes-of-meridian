# Multiplayer-Vorbereitung: Perspektive, Karten und Last

Nach dem [Parteienmodell und lokalen Harness](multiplayer-simulationsmodell.md); keine Balanceänderung oder neue Multiplayeroberfläche.

- [ ] Lokale Perspektive für Fog, Auswahl, HUD, Minimap, Effekte, Meldungen und Audio ausdrücklich führen statt Team 0 vorauszusetzen; Fraktion und Parteienkennzeichnung trennen.
- [ ] Vor Perspektivwechsel Simulationsabhängigkeiten entfernen: sichtabhängige Explosionen verbrauchen Simulations-RNG, der Medic-Cooldown wird ebenfalls sichtabhängig gesetzt (`src/simulation/combat.ts`, `src/effects.ts`). Bestehenden Einzelspielverlauf schützen.
- [ ] Drei/vier gleichzeitige Starts auf allen Karten technisch prüfen: eindeutige HQ-Plätze, freie Startaufstellung und erreichbare Ressourcen; keine Zusage gleicher Ressourcen oder fairer Rush-Distanzen.
- [ ] Mehrparteienlast gezielt messen, bevor Limits/Optimierungen beschlossen werden; vorhandene [mobile Lastbefunde](mobile-performance.md) berücksichtigen. Zusätzliche Langläufe gesondert freigeben lassen.

Codebefund: Alle drei Rezepte in `src/battlefields/` deklarieren vier `startSites`; `battlefieldStartSites` sucht passende HQ-Plätze, `startingPositions` kann intern bis zu vier vergeben; das Einzelspiel belegt weiterhin zwei. Die neuen kurzen Mehrparteien-Starttests für Mothership sind noch nicht ausgeführt; ihre Abnahme und die übrigen Karten stehen unter [Mehrparteien-Prüfungen](multiplayer-simulationsmodell.md). Vier Kandidaten sind kein Balance- oder Performancenachweis.
