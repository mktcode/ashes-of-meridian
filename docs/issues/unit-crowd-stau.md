# Crowd: Arbeitsweg klemmt an stehender Basisarmee

Bei der Desert-Neugestaltung legt die veränderte Anfangsaufstellung einen Stau in der entwickelten Testbasis frei. Bewegungs-/Yield-Regeln nicht im Geometrieauftrag nebenbei ändern.

## Reproduktion und Befund

- CPU-Szenario aus `tests/ashes-of-meridian-simulation.check.cjs`: `battle()` mit Seed 1409, feste SW-Basis, `populateBase`, KI deaktiviert. Barracks bei (−39, 53) um 100 HP beschädigen; den nächsten eigenen Worker zur Reparatur schicken. Zusätzliche fremde/tote Worker wie im Reparaturtest anlegen.
- Ohne den inzwischen expliziten freien Worker-Anmarsch im Test startet der gewählte Worker ungefähr bei `x=−52.90, z=44.67`. Nach 25 Simulationssekunden steht er bei `x=−47.77, z=42.50` zwischen HQ, Hero, Medics und Infanterie. Reparaturauftrag besteht, Wegliste ist leer, Gebäude bleibt bei 1050/1150 HP.
- Auch nach `staticGrid.fill(0)` und anschließendem Neuaufbau der Gebäudeblocker reproduzierbar. Das ursprüngliche Gelände ist somit nicht die alleinige Sperre; die Rasterroute ist vorhanden. Ein freier, körpergeprüfter Anmarsch von nördlich der Barracks repariert regulär.

## Korrektur und technische Prüfung

Die lokale Umfahrung und das seitliche Yield kannten ursprünglich nur eine bevorzugte Seite. War diese an einer Gebäudeecke oder in der Formation versperrt, blieb die freie Gegenseite ungenutzt. Bewegte Kampfgruppen sowie Worker mit Bau-/Reparaturauftrag dürfen nun deterministisch auf die Gegenseite wechseln und behalten diese Wahl, bis geradliniger Fortschritt oder eine Neuplanung sie wieder freigibt. Regulärer Minenverkehr behält seine bisherige einseitige Steuerung; seine bestehenden Jitter- und Produktivitätsverträge bleiben damit erhalten. Yield-Ziele prüfen weiterhin Körper und Terrain und verschieben weder Gegner noch fest zugewiesene Einheiten.

Der frühere freie Testanmarsch wurde entfernt: Der ursprünglich klemmende Worker erreicht und repariert die Barracks jetzt aus der entwickelten Basisaufstellung. Ergänzt sind ein isolierter Fall mit nur auf der Gegenseite freier Ecke sowie eine 24 Einheiten starke Formation um einen echten Mothership-Hangar. Gezielte Prüfungen bestehen außerdem für Gegenverkehr, Abstände, Yield-Priorität, blockierte Manöver, Neuplanung und sechs Minuten Minenverkehr über vier Szenarien. Vollständige Simulations- und KI-Blöcke wurden nicht gestartet.

Das [statische Audit (PERF-1/2)](audit-welle-01-befunde.md#performance-erst-wirkung-und-kosten-abgrenzen) bleibt eine getrennte Messfrage zu Live-Kollisionsscans und Neuplanung; den innerhalb eines Ticks veraltenden Kampfhash nicht als Ersatz verwenden.

Offen ist die menschliche Bestätigung mit den tatsächlich auffälligen Gruppenwegen an den Mothership-Hangars und in dichten Basen: [Playtest-Validierung](playtest-validation.md).
