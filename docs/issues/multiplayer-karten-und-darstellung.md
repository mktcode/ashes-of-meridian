# Multiplayer-Vorbereitung: Perspektive, Karten und Last

Nach dem [Parteienmodell und lokalen Harness](multiplayer-simulationsmodell.md); der freigegebene [Netzwerkprototyp](multiplayer-netzwerk.md) besitzt jetzt eine Session-Oberfläche mit Kartenauswahl. Keine Balanceänderung.

- [ ] Beide Spielerperspektiven im Netzwerkprototyp einschließlich Bewegungsglättung, Kampf-Effekten und Audio durch den Menschen abnehmen. Ein manueller Parteiwechsel ist dort gesperrt; eigene/fremde Kennzeichnung ist perspektivabhängig, individuelle Farben für vier Parteien sind nicht gestaltet.
- [ ] Bei gesonderter Freigabe Perspektivwechsel im laufenden Mehrparteien-Gefecht prüfen; vorhandene Zustands-/HUD-/Renderprüfungen ersetzen keine vollständige Partie.
- [ ] Verbleibende Kartenfragen gezielt prüfen: bei Bedarf Gas-/Raffineriezugang und weitere Seeds; begrenzte Start-/Alloy-Nachweise stehen in den [Mehrparteien-Prüfungen](multiplayer-simulationsmodell.md). Keine Zusage gleicher Ressourcen oder fairer Rush-Distanzen.
- [ ] Mehrparteienlast gezielt messen, bevor Limits/Optimierungen beschlossen werden; vorhandene [mobile Lastbefunde](mobile-performance.md) berücksichtigen. Zusätzliche Langläufe gesondert freigeben lassen.

Technischer Stand: [Lokale Szenarioperspektive](../architecture.md#teamzustand-sicht-und-ki) und [Szenario-Effekttrennung](../architecture.md#welt-darstellung-und-zufall) sind umgesetzt. Synthetische Zustandsprüfungen decken echte Sichtumschaltung, gleiche Kampfzustände/RNG und lokale Alarmfilter ab; technische UI-/Renderprüfungen decken Akteursbindung, Fog, Auswahl, HUD, Marker und unveränderte Gebäudeausrichtung ab. Der technische Zwei-Client-Browsernachweis und seine Grenzen stehen im [Netzwerkpaket](multiplayer-netzwerk.md). Keine Hör- oder Echtgeräteabnahme. Einzelspiel bleibt auf Partei 0.

Codebefund: Alle drei Rezepte in `src/battlefields/` deklarieren vier `startSites`; `battlefieldStartSites` sucht passende HQ-Plätze, `startingPositions` kann intern bis zu vier vergeben; das Einzelspiel belegt weiterhin zwei. Prüfnachweise und ihre Grenzen führen die [Mehrparteien-Prüfungen](multiplayer-simulationsmodell.md). Vier Kandidaten sind kein Balance- oder Performancenachweis.
