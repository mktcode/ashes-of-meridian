# Multiplayer-Vorbereitung: Befehls- und Synchronisationsgrenzen

Weitere Synchronisations-/Transportarbeit nach [Parteienmodell](multiplayer-simulationsmodell.md) und [Perspektivtrennung](multiplayer-karten-und-darstellung.md). **Kein Transport, Backend oder Lobbybau ohne weitere Freigabe.**

- [ ] Den kurzen neuen Integrationsfall `scenario command tick precedes production…` im Simulationsblock gesondert freigeben und ausführen: Tickbeginn, Produktion, Stopp mit Callback-Eingabe und Queue-Neustart. Bisher nur auf Syntax geprüft.
- [ ] Zustandsumfang für Abgleich/Wiederherstellung bestimmen, einschließlich Befehlsqueue/RNG. Kamera/Tempo, Ereignisausgabe und rein visuelle Zustände separat behandeln; heutiger Expeditionscheckpoint ist kein Gefechtssnapshot.
- [ ] Autoritativen Simulationsserver als separates start-/deploybares Paket im selben Repository vorbereiten; gemeinsamen Code wiederverwenden statt die Simulation zu kopieren. Einzelspiel bleibt dienstfrei über `file://` startbar.
- [ ] Kleinen vertikalen Netzwerkprototyp separat freigeben: Session erstellen, Code teilen, mit zwei Browsern beitreten und eigene Einheiten bewegen. Raumcode von persönlicher Verbindungsidentität trennen; noch keine Expeditionen, vollständigen KI-Partien oder aufwendige Wiederverbindung.
- [ ] Vor Transportbau minimale Session-/Abbruchregeln, Sichtfilterung der übertragenen Daten, Nachrichtenlimits und Betrieb festlegen.

Die [Aktions- und Szenario-Tickgrenze](../architecture.md#teamzustand-sicht-und-ki) ist vorhanden; synthetische Scheduler-/Zustandstests prüfen Reihenfolge, erneute Validierung, Begrenzung, Callback-Isolation und Fehler-/Stoppverhalten. Einreihung ist noch keine Ausführungsbestätigung; das spätere Clientprotokoll muss beide Antworten unterscheiden. Die umgestellte KI ist noch nicht durch neue autonome Läufe geprüft; diese benötigen gesonderte Freigabe. Kein Netzwerktransport vorhanden. `src/app.ts` taktet Simulation und Effekte lokal; UI-Pause, Tab-Verbergen und Tempo steuern den Ablauf. Seed und feste Schritte allein belegen kein browserübergreifendes Lockstep. Gemeinsame Pause-/Abbruchregeln gehören in die spätere [Spielmechanik](multiplayer-expeditionen.md).
