# Multiplayer-Vorbereitung: Perspektive, Karten und Last

Nach dem [Parteienmodell und lokalen Harness](multiplayer-simulationsmodell.md); keine Balanceänderung oder neue Multiplayeroberfläche.

- [ ] Lokale Szenarioperspektiven visuell/akustisch durch den Menschen abnehmen, sobald ein Szenario-Einstieg dafür freigegeben ist. Noch kein öffentlicher Umschalter; eigene/fremde Kennzeichnung ist perspektivabhängig, individuelle Farben für vier Parteien sind nicht gestaltet.
- [ ] Bei gesonderter Freigabe Perspektivwechsel im laufenden Mehrparteien-Gefecht prüfen; vorhandene Zustands-/HUD-/Renderprüfungen ersetzen keine vollständige Partie.
- [ ] Verbleibende Kartenfragen gezielt prüfen: erweiterte Mothership-Assertions, bei Bedarf Gas-/Raffineriezugang und weitere Seeds; begrenzte Start-/Alloy-Nachweise stehen in den [Mehrparteien-Prüfungen](multiplayer-simulationsmodell.md). Keine Zusage gleicher Ressourcen oder fairer Rush-Distanzen.
- [ ] Mehrparteienlast gezielt messen, bevor Limits/Optimierungen beschlossen werden; vorhandene [mobile Lastbefunde](mobile-performance.md) berücksichtigen. Zusätzliche Langläufe gesondert freigeben lassen.

Technischer Stand: [Lokale Szenarioperspektive](../architecture.md#teamzustand-sicht-und-ki) und [Szenario-Effekttrennung](../architecture.md#welt-darstellung-und-zufall) sind umgesetzt. Synthetische Zustandsprüfungen decken echte Sichtumschaltung, gleiche Kampfzustände/RNG und lokale Alarmfilter ab; technische UI-/Renderprüfungen decken Akteursbindung, Fog, Auswahl, HUD, Marker und unveränderte Gebäudeausrichtung ab. Keine Browser-, Hör- oder Echtgeräteabnahme. Einzelspiel bleibt auf Partei 0.

Codebefund: Alle drei Rezepte in `src/battlefields/` deklarieren vier `startSites`; `battlefieldStartSites` sucht passende HQ-Plätze, `startingPositions` kann intern bis zu vier vergeben; das Einzelspiel belegt weiterhin zwei. Prüfnachweise und ihre Grenzen führen die [Mehrparteien-Prüfungen](multiplayer-simulationsmodell.md). Vier Kandidaten sind kein Balance- oder Performancenachweis.
