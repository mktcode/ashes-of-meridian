# Multiplayer-Vorbereitung: offene Mehrparteien-Prüfungen

Technische Szenariogrenzen: [Architektur](../architecture.md#teamzustand-sicht-und-ki). Kein öffentlicher Mehrspielermodus; weitere Pakete nach [Rahmen](multiplayer-rahmen.md).

- [ ] Die zwei kurzen neuen 3-/4-Parteien-Szenarien im Simulationsblock ausdrücklich freigeben und ausführen: Starts, Wiederholbarkeit, KI-Zuordnung und Stopp ohne Expeditionsauszahlung. Noch nicht ausgeführt; kein Bedarf für die vollständigen Langlaufblöcke daraus ableiten.
- [ ] Zusätzliche Parteien auf Desert und Alien Planet gezielt auf freie Aufstellung/Ressourcenzugänge prüfen; aktuelle neue Szenarien verwenden nur Mothership.
- [ ] Bei Freigabe gezielte KI-Fälle für mehrere feindliche bzw. nichtfeindliche Parteien ergänzen; Nichtfeindschaft darf nicht versehentlich Zielwahl oder Fähigkeiten auslösen.

Die mechanisch angepassten bestehenden KI-/Simulationsdateien sind nur auf Syntax geprüft. Start-/Replayprüfungen und KI-Läufe benötigen gemäß [Prüfverfahren](../testing.md) gesonderte aktuelle Freigabe. Standardtests prüfen Zustands-/Besitzverträge und getrennte Sichtpuffer, nicht die vollständige Mehrparteienpartie. Darstellung/Statistik und sichtabhängige Simulationskopplung bleiben im [Perspektivpaket](multiplayer-karten-und-darstellung.md) offen; keine Referenzwerte zum Grünmachen ändern.
