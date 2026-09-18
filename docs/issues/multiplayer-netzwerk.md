# Multiplayer-Vorbereitung: Befehls- und Synchronisationsgrenzen

Nach [Parteienmodell](multiplayer-simulationsmodell.md) und [Perspektivtrennung](multiplayer-karten-und-darstellung.md). **Kein Transport, Backend oder Lobbybau ohne weitere Freigabe.**

- [ ] Spielaktionen an einer prüfbaren Akteursgrenze bündeln; direkte UI-Mutationen wie Rally-Ziele (`src/ui/input.ts`) erfassen. Besitz-/Zielprüfung nicht einem späteren Client überlassen.
- [ ] Simulationsschritt, Befehlsreihenfolge, Zufall und lokale Darstellung sauber abgrenzen; Perspektivwechsel darf den Simulationsverlauf nicht verändern.
- [ ] Zustandsumfang für Abgleich/Wiederherstellung bestimmen; heutiger Expeditionscheckpoint ist kein Gefechtssnapshot.
- [ ] Autoritätsmodell, Transport, Desync-/Reconnect-Bedarf und Betrieb als spätere Entscheidung vergleichen, nicht vorweg festlegen. Einzelspiel bleibt dienstfrei über `file://` startbar.

Codebefund: Kein Netzwerktransport vorhanden. `src/app.ts` taktet Simulation und Effekte lokal; UI-Pause, Tab-Verbergen und Tempo steuern den Ablauf. Seed und feste Schritte allein belegen kein browserübergreifendes Lockstep. Gemeinsame Pause-/Abbruchregeln gehören in die spätere [Spielmechanik](multiplayer-expeditionen.md).
