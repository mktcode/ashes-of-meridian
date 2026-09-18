# Multiplayer-Vorbereitung: offene Mehrparteien-Prüfungen

Technische Szenariogrenzen: [Architektur](../architecture.md#teamzustand-sicht-und-ki). Kein öffentlicher Mehrspielermodus; weitere Pakete nach [Rahmen](multiplayer-rahmen.md).

- [ ] Zusätzliche Parteien auf Desert und Alien Planet gezielt auf freie Aufstellung/Ressourcenzugänge prüfen; aktuelle neue Szenarien verwenden nur Mothership.
- [ ] Bei Freigabe gezielte KI-Fälle für mehrere feindliche bzw. nichtfeindliche Parteien ergänzen; Nichtfeindschaft darf nicht versehentlich Zielwahl oder Fähigkeiten auslösen.

Prüfkontext: Die beiden kurzen 3-/4-Parteien-Szenarien auf Mothership bestehen (Seed 1409, jeweils 0,1 Sekunden Simulationszeit): eindeutige Starts, wiederholbarer Anfangszustand, Controller-Dispatch und Stopp ohne Expeditionsauszahlung. Der KI-Dispatch ist dabei instrumentiert; echte Mehrparteien-KI, vollständige Partien und Ressourcen-Erreichbarkeit sind damit nicht abgenommen. Die übrigen mechanisch angepassten KI-/Simulationsfälle sind nur auf Syntax geprüft. Weitere Start-/Replayprüfungen und KI-Läufe benötigen gemäß [Prüfverfahren](../testing.md) gesonderte aktuelle Freigabe. Standardtests prüfen Zustands-/Besitzverträge und getrennte Sichtpuffer, nicht die vollständige Mehrparteienpartie. Darstellung/Statistik und sichtabhängige Simulationskopplung bleiben im [Perspektivpaket](multiplayer-karten-und-darstellung.md) offen; keine Referenzwerte zum Grünmachen ändern.
