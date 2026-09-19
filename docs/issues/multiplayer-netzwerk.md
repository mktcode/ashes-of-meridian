# Multiplayer-Vorbereitung: Befehls- und Synchronisationsgrenzen

Weitere Synchronisations-/Transportarbeit nach [Parteienmodell](multiplayer-simulationsmodell.md) und [Perspektivtrennung](multiplayer-karten-und-darstellung.md). **Kein Transport, Backend oder Lobbybau ohne weitere Freigabe.**

- [ ] Simulationsschritt, Befehlsreihenfolge, Zufall und lokale Darstellung sauber abgrenzen; Perspektivwechsel darf den Simulationsverlauf nicht verändern.
- [ ] Zustandsumfang für Abgleich/Wiederherstellung bestimmen; heutiger Expeditionscheckpoint ist kein Gefechtssnapshot.
- [ ] Autoritativen Simulationsserver als separates start-/deploybares Paket im selben Repository vorbereiten; gemeinsamen Code wiederverwenden statt die Simulation zu kopieren. Einzelspiel bleibt dienstfrei über `file://` startbar.
- [ ] Kleinen vertikalen Netzwerkprototyp separat freigeben: Session erstellen, Code teilen, mit zwei Browsern beitreten und eigene Einheiten bewegen. Raumcode von persönlicher Verbindungsidentität trennen; noch keine Expeditionen, vollständigen KI-Partien oder aufwendige Wiederverbindung.
- [ ] Vor Transportbau minimale Session-/Abbruchregeln, Sichtfilterung der übertragenen Daten, Nachrichtenlimits und Betrieb festlegen.

Die gemeinsame unmittelbare [Aktionsgrenze](../architecture.md#teamzustand-sicht-und-ki) ist vorhanden, einschließlich Rally-Zielen und Akteurs-/Zielprüfung. Die umgestellte KI ist noch nicht durch neue autonome Läufe geprüft; diese benötigen gesonderte Freigabe. Kein Netzwerktransport vorhanden. `src/app.ts` taktet Simulation und Effekte lokal; UI-Pause, Tab-Verbergen und Tempo steuern den Ablauf. Seed und feste Schritte allein belegen kein browserübergreifendes Lockstep. Gemeinsame Pause-/Abbruchregeln gehören in die spätere [Spielmechanik](multiplayer-expeditionen.md).
