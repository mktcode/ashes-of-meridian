# Crowd: Arbeitsweg klemmt an stehender Basisarmee

Bei der Desert-Neugestaltung legt die veränderte Anfangsaufstellung einen Stau in der entwickelten Testbasis frei. Bewegungs-/Yield-Regeln nicht im Geometrieauftrag nebenbei ändern.

## Reproduktion und Befund

- CPU-Szenario aus `tests/ashes-of-meridian-simulation.check.cjs`: `battle()` mit Seed 1409, feste SW-Basis, `populateBase`, KI deaktiviert. Barracks bei (−39, 53) um 100 HP beschädigen; den nächsten eigenen Worker zur Reparatur schicken. Zusätzliche fremde/tote Worker wie im Reparaturtest anlegen.
- Ohne den inzwischen expliziten freien Worker-Anmarsch im Test startet der gewählte Worker ungefähr bei `x=−52.90, z=44.67`. Nach 25 Simulationssekunden steht er bei `x=−47.77, z=42.50` zwischen HQ, Hero, Medics und Infanterie. Reparaturauftrag besteht, Wegliste ist leer, Gebäude bleibt bei 1050/1150 HP.
- Auch nach `staticGrid.fill(0)` und anschließendem Neuaufbau der Gebäudeblocker reproduzierbar. Das ursprüngliche Gelände ist somit nicht die alleinige Sperre; die Rasterroute ist vorhanden. Ein freier, körpergeprüfter Anmarsch von nördlich der Barracks repariert regulär.

## Offen

Lokale Ausweich-/Yield- und Neuplanungsbedingungen für Arbeitsaufträge untersuchen. Eigenständige Crowd-Regression aus der klemmenden Aufstellung ableiten, dabei Körperabstände, Prioritäten und fremde Einheiten erhalten. Der Reparaturtest isoliert weiterhin Auswahl, tatsächlichen Anmarsch und Reparatur, ist aber kein Nachweis für Auflösung dieses Armeestaus.

Auch in menschlichen Runs prüfen: [Playtest-Validierung](playtest-validation.md).
