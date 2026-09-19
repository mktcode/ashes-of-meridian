# Multiplayer-Vorbereitung: offene Mehrparteien-Prüfungen

Technische Szenariogrenzen: [Architektur](../architecture.md#teamzustand-sicht-und-ki). Kein öffentlicher Mehrspielermodus; vorerst ausschließlich jeder gegen jeden nach [Rahmen](multiplayer-rahmen.md), keine 2on2-KI.

- [ ] Bei Freigabe gezielte echte FFA-KI-Fälle für mehrere feindliche Parteien prüfen; bisher ist nur der Controller-Dispatch instrumentiert.
- [ ] Erweiterte FFA-/Routenassertionen auch auf Mothership ausführen; dort ist bisher nur die frühere Start-/Stopp-Prüfung abgenommen.

Prüfkontext: Desert und Alien Planet bestehen mit jeweils drei und vier Parteien die kurzen FFA-Szenarien (Seed 1409, je 0,1 Sekunden Simulationszeit): eindeutige HQ-Plätze, freie Startworker, sichtbares Start-Alloy mit vollständigen Navigationspfaden zu Abbau und HQ-Rückgabe, wiederholbarer Anfangszustand, Controller-Dispatch und Stopp ohne Expeditionsauszahlung. Das belegt weder tatsächliche Erntezyklen noch Gas-/Raffineriezugang, weitere Seeds, Balance oder vollständige KI-Partien. Motherships bisheriger Start-/Stopp-Nachweis bleibt auf den früheren Prüfumfang begrenzt.

Weitere Simulations-/KI-Läufe benötigen gemäß [Prüfverfahren](../testing.md) gesonderte aktuelle Freigabe. Darstellung/Statistik und die Prüfung des tatsächlichen Perspektivwechsels bleiben im [Perspektivpaket](multiplayer-karten-und-darstellung.md) offen; keine Referenzwerte zum Grünmachen ändern.
