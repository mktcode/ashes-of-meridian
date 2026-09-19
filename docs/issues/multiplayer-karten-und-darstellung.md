# Multiplayer-Vorbereitung: Perspektive, Karten und Last

Nach dem [Parteienmodell und lokalen Harness](multiplayer-simulationsmodell.md); keine Balanceänderung oder neue Multiplayeroberfläche.

- [ ] Lokale Perspektive für Fog, Auswahl, HUD, Minimap, Effekte, Meldungen und Audio ausdrücklich führen statt Team 0 vorauszusetzen; Fraktion und Parteienkennzeichnung trennen.
- [ ] Perspektivwechsel für Szenarien gegen gleichen Simulationszustand und RNG prüfen. Die [Szenario-Effekttrennung](../architecture.md#welt-darstellung-und-zufall) entkoppelt Effektzufall und Medic-Heilmarker-Cooldown bereits; die tatsächliche UI-Perspektive ist noch nicht umgestellt. Einzelspiel bleibt auf Partei 0 und behält seinen bisherigen Effekt-/Cooldownvertrag.
- [ ] Verbleibende Kartenfragen gezielt prüfen: erweiterte Mothership-Assertions, bei Bedarf Gas-/Raffineriezugang und weitere Seeds; begrenzte Start-/Alloy-Nachweise stehen in den [Mehrparteien-Prüfungen](multiplayer-simulationsmodell.md). Keine Zusage gleicher Ressourcen oder fairer Rush-Distanzen.
- [ ] Mehrparteienlast gezielt messen, bevor Limits/Optimierungen beschlossen werden; vorhandene [mobile Lastbefunde](mobile-performance.md) berücksichtigen. Zusätzliche Langläufe gesondert freigeben lassen.

Codebefund: Alle drei Rezepte in `src/battlefields/` deklarieren vier `startSites`; `battlefieldStartSites` sucht passende HQ-Plätze, `startingPositions` kann intern bis zu vier vergeben; das Einzelspiel belegt weiterhin zwei. Prüfnachweise und ihre Grenzen führen die [Mehrparteien-Prüfungen](multiplayer-simulationsmodell.md). Vier Kandidaten sind kein Balance- oder Performancenachweis.
