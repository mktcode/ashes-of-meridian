# Multiplayer-Vorbereitung: offene Mehrparteien-Prüfungen

Technische Szenariogrenzen: [Architektur](../architecture.md#teamzustand-sicht-und-ki). Der [Netzwerkprototyp](multiplayer-netzwerk/README.md) nutzt zwei menschliche Parteien; darüber hinaus vorerst ausschließlich jeder gegen jeden nach [Rahmen](multiplayer-rahmen.md), keine 2on2-KI.

- [ ] Bei Freigabe gezielte echte FFA-KI-Fälle für mehrere feindliche Parteien prüfen; bisher ist nur der Controller-Dispatch instrumentiert.

Prüfkontext: Mothership, Desert und Alien Planet bestehen mit jeweils drei und vier Parteien die kurzen FFA-Szenarien (Seed 1409, je 0,1 Sekunden Simulationszeit): eindeutige HQ-Plätze, freie Startworker, sichtbares Start-Alloy mit vollständigen Navigationspfaden zu Abbau und HQ-Rückgabe, wiederholbarer Anfangszustand, Controller-Dispatch und Stopp ohne Expeditionsauszahlung. Das belegt weder tatsächliche Erntezyklen noch Gas-/Raffineriezugang, weitere Seeds, Balance oder vollständige KI-Partien.

## Offene Befunde im gemeinsamen Unterbau

Vollständige KI-/Simulationsläufe auf `f0dba62`, Node v23.11.1, ohne Namensfilter. Nach Anpassung veralteter Fixtures an Karten-, Team- und KI-Verträge besteht der Simulationsblock mit 97/97 Fällen. Der KI-Block bestand unverändert mit 39/40 Fällen. Keine Spielregeln, Referenzwerte oder Laufzeitgrenzen wurden zum Grünmachen geändert.

- [ ] KI-Test `autonomous 2 vs 0: paid economy, production, strategic pressure and completed battle`: Mothership, Seed 1471, kein Ergebnis nach 24.000 Schritten à 0,05 Sekunden (20 simulierte Minuten). Beide Seiten bauen vollständige Wirtschaft und Produktion auf, greifen wiederholt an, verlieren Armeen, ziehen sich zurück und ersetzen sie. Keine Seite erreicht dauerhaft das gegnerische HQ; bei Minute 20 besitzen beide HQs wieder volle 2600 HP und beide Seiten nur kleine neue Kampfgruppen bei weiterhin intakter Produktion. Das ist ein reproduzierbarer Attritions-/Zielwahl-Stillstand, kein fehlender KI-Tick und kein Ressourcenstillstand.
- [ ] Im selben Lauf steckt Court-Rifle 138 ab ungefähr Minute 7 dauerhaft am Ausgang von Barracks 129 bei `(-86.8, 84.1)`: Position `(-86.25, 86.25)`, `pathStatus: unreachable`, 254 Recovery-Versuche bis Minute 20. Der Produktionsausgang ist damit ein konkreter Navigationsfehler. Er schwächt eine Seite, erklärt den gesamten beidseitigen Attritionsstillstand aber nicht allein. Ausgangsfreiraum, Nachbarblocker und Recovery getrennt untersuchen; das Partielimit nicht pauschal erhöhen.

Der zuvor auf `0fd975b` ausgefallene Fall `autonomous 1 vs 1` besteht im aktuellen Lauf. Der vermeintliche Worker-Langlaufstillstand war dagegen eine zu strenge Startminuten-Erwartung und ist im [Worker-Issue](worker-bauwegfindung/issue.md#belastbarer-befund-und-abgrenzung) abgegrenzt.

Weitere Simulations-/KI-Läufe benötigen gemäß [Prüfverfahren](../testing.md) gesonderte aktuelle Freigabe. Visuelle Abnahme und Perspektivwechsel in einer laufenden Partie bleiben im [Perspektivpaket](multiplayer-karten-und-darstellung.md) offen; Ergebnisstatistik bleibt ein Einzelspieler-Vertrag; keine Referenzwerte zum Grünmachen ändern.
