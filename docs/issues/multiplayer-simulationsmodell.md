# Multiplayer-Vorbereitung: offene Mehrparteien-Prüfungen

Technische Szenariogrenzen: [Architektur](../architecture.md#teamzustand-sicht-und-ki). Der [Netzwerkprototyp](multiplayer-netzwerk/README.md) nutzt zwei menschliche Parteien; darüber hinaus vorerst ausschließlich jeder gegen jeden nach [Rahmen](multiplayer-rahmen.md), keine 2on2-KI.

- [ ] Bei Freigabe gezielte echte FFA-KI-Fälle für mehrere feindliche Parteien prüfen; bisher ist nur der Controller-Dispatch instrumentiert.

Prüfkontext: Mothership, Desert und Alien Planet bestehen mit jeweils drei und vier Parteien die kurzen FFA-Szenarien (Seed 1409, je 0,1 Sekunden Simulationszeit): eindeutige HQ-Plätze, freie Startworker, sichtbares Start-Sternenschlacke mit vollständigen Navigationspfaden zu Abbau und HQ-Rückgabe, wiederholbarer Anfangszustand, Controller-Dispatch und Stopp ohne Expeditionsauszahlung. Das belegt weder tatsächliche Erntezyklen noch Gas-/Raffineriezugang, weitere Seeds, Balance oder vollständige KI-Partien.

## Tolerierte Grenzen im gemeinsamen Unterbau

Vollständige KI-/Simulationsläufe auf Basis von `f0dba62`, Node v23.11.1, ohne Namensfilter. Nach Anpassung veralteter Fixtures an Karten-, Team- und KI-Verträge besteht der Simulationsblock mit 97/97 Fällen; nach der unten beschriebenen engen Pattregel besteht der KI-Block mit 40/40 Fällen. Keine Spielregeln, Referenzwerte oder Laufzeitgrenzen wurden zum Grünmachen geändert.

Die autonome Partie Court gegen Free Marches auf Mothership, Seed 1471, endet nach 24.000 Schritten à 0,05 Sekunden nicht. Beide Seiten bauen vollständige Wirtschaft und Produktion auf, greifen wiederholt an, verlieren Armeen, ziehen sich zurück und ersetzen sie. Keine Seite erreicht dauerhaft das gegnerische HQ; bei Minute 20 besitzen beide HQs wieder volle 2600 HP und beide Seiten kleine neue Kampfgruppen bei weiterhin intakter Produktion. Für den Prototyp ist diese seltene aktive Pattlage akzeptiert: Genau dieser feste Fall darf am unveränderten 20-Minuten-Limit ohne Sieger enden, muss dann aber weiterhin HQ und Kampfeinheiten beider Seiten sowie die allgemeinen Produktions-, Bau-, Angriffs-, Ressourcen- und Abstandsnachweise erfüllen. Alle übrigen Paarungen verlangen weiterhin einen Abschluss.

Im selben Lauf steckt Court-Rifle 138 ab ungefähr Minute 7 dauerhaft am Ausgang von Barracks 129 bei `(-86.8, 84.1)`: Position `(-86.25, 86.25)`, `pathStatus: unreachable`, 254 gedrosselte Recovery-Versuche bis Minute 20. Dieser isolierte Produktionsausgang bleibt als tolerierter Edge-Case dokumentiert; er blockiert weder Simulation noch Wirtschaft und wird nicht als gewünschtes Verhalten in einem Regressionstest festgeschrieben. Bei Reproduktion in normalem Spiel, weiteren Seeds/Karten oder mit mehreren Einheiten wird Ausgangsfreiraum, Nachbarblockierung und Recovery neu priorisiert.

Der zuvor auf `0fd975b` ausgefallene Fall `autonomous 1 vs 1` besteht im aktuellen Lauf. Der vermeintliche Worker-Langlaufstillstand war dagegen eine zu strenge Startminuten-Erwartung und ist im [Worker-Issue](worker-bauwegfindung/issue.md#belastbarer-befund-und-abgrenzung) abgegrenzt.

Weitere Simulations-/KI-Läufe benötigen gemäß [Prüfverfahren](../testing.md) gesonderte aktuelle Freigabe. Visuelle Abnahme und Perspektivwechsel in einer laufenden Partie bleiben im [Perspektivpaket](multiplayer-karten-und-darstellung.md) offen; Ergebnisstatistik bleibt ein Einzelspieler-Vertrag; keine Referenzwerte zum Grünmachen ändern.
