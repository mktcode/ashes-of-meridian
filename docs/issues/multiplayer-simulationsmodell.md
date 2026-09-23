# Multiplayer-Vorbereitung: offene Mehrparteien-Prüfungen

Technische Szenariogrenzen: [Architektur](../architecture.md#teamzustand-sicht-und-ki). Der [Netzwerkprototyp](multiplayer-netzwerk/README.md) nutzt zwei menschliche Parteien; darüber hinaus vorerst ausschließlich jeder gegen jeden nach [Rahmen](multiplayer-rahmen.md), keine 2on2-KI.

- [ ] Bei Freigabe gezielte echte FFA-KI-Fälle für mehrere feindliche Parteien prüfen; bisher ist nur der Controller-Dispatch instrumentiert.

Prüfkontext: Mothership, Desert und Alien Planet bestehen mit jeweils drei und vier Parteien die kurzen FFA-Szenarien (Seed 1409, je 0,1 Sekunden Simulationszeit): eindeutige HQ-Plätze, freie Startworker, sichtbares Start-Alloy mit vollständigen Navigationspfaden zu Abbau und HQ-Rückgabe, wiederholbarer Anfangszustand, Controller-Dispatch und Stopp ohne Expeditionsauszahlung. Das belegt weder tatsächliche Erntezyklen noch Gas-/Raffineriezugang, weitere Seeds, Balance oder vollständige KI-Partien.

## Offene Befunde im gemeinsamen Unterbau

Vollständige KI-/Simulationsläufe auf `0fd975b`, Node v23.11.1, ohne Namensfilter. Keine Referenzen oder Erwartungen geändert; eine Zuordnung der Fehler zu den Multiplayer-Änderungen oder einem älteren Stand ist noch nicht belegt.

- [ ] KI-Test `autonomous 1 vs 1: paid economy, production, strategic pressure and completed battle`: Desert, Seed 1451, kein Ergebnis nach 24.000 Schritten à 0,05 Sekunden (20 simulierte Minuten). Produktion/Bauten/Angriffsaktivität bestehen ihre vorgelagerten Prüfungen. Ursache des ausbleibenden Abschlusses eingrenzen, nicht pauschal das Zeitlimit erhöhen.
- [ ] Der [Worker-Langlaufbefund](worker-bauwegfindung/issue.md#belastbarer-befund-und-abgrenzung) bleibt ausschließlich im Worker-Issue maßgeblich und benötigt vor einer erneuten Ausführung eine aktuelle Freigabe.

Weitere Simulations-/KI-Läufe benötigen gemäß [Prüfverfahren](../testing.md) gesonderte aktuelle Freigabe. Visuelle Abnahme und Perspektivwechsel in einer laufenden Partie bleiben im [Perspektivpaket](multiplayer-karten-und-darstellung.md) offen; Ergebnisstatistik bleibt ein Einzelspieler-Vertrag; keine Referenzwerte zum Grünmachen ändern.
