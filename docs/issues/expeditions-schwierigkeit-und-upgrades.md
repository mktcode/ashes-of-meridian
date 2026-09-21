# Expeditionsprogression: offene Anschlussentscheidungen

Die implementierten Doktrinen, Tiefenstufen, Vorteile und Flottenupgrades sind in den [Spielregeln](../gameplay.md) beschrieben. Die technische Planung bleibt in Git; offene menschliche Abnahme ist maßgeblich in der [Run-Validierung](playtest-validation.md) geführt. Automatische autonome Partien sind kein Nachweis ausgewogener menschlicher Schwierigkeit.

## Mehrparteien-Expeditionen

Die Expedition nutzt jetzt [Free-for-all](../gameplay.md#gefecht-und-fortschritt) mit persistenten Vorteilen je Gegner-Slot. Die frühen Eintrittsschwellen dienen dem aktuellen menschlichen Testauftrag; Abnahme einschließlich KI-gegen-KI-Druck und Mobilperformance steht in der [Run-Validierung](playtest-validation.md#ffa-expeditionen-gezielte-abnahme). Die folgenden früheren Ein-Gegner-Beobachtungen sind keine Balancebestätigung für FFA; gegenseitige KI-Angriffe können den Spielerdruck auch reduzieren.

## FFA: Rückzug vor dem letzten HQ

Menschlicher FFA-Test: Der Spieler ließ sich absichtlich besiegen. Nach Zerstörung aller übrigen Strukturen zogen die Angreifer ab; erst deutlich später zerstörte der letzte KI-Gegner das verbliebene HQ. Stage, Karte, Fraktionen, Seed und strategischer KI-Zustand fehlen; keine reproduzierte Ursachenbestätigung.

Die beauftragte [KI-Planung](../architecture.md#teamzustand-sicht-und-ki) ersetzt den starren Angriffstimeout durch Fortschritts-/Stillstandsprüfung und ergänzt Abschlusspriorität, Zielbindung sowie lokale Basisverteidigung. Stage-Druck und Reaktionstempo haben zentrale Regler mit Obergrenzen beziehungsweise Mindestverzögerungen. Der konkrete ursprüngliche Rückzugsgrund bleibt ohne damaligen KI-Zustand unbewiesen. Menschlich erneut prüfen: unverteidigtes HQ fertigstellen, erfolgreiche Belagerung fortsetzen, bei ernsthafter Gefahr sinnvoll zurückziehen und im FFA nicht zwischen Gegnern pendeln. Abnahme und noch nicht freigegebene autonome Langläufe stehen in der [Run-Validierung](playtest-validation.md#ffa-expeditionen-gezielte-abnahme).

## Menschliche Neubewertung der Rush- und Startökonomie

Vergleichsfall vor der beauftragten Balanceanpassung: Nach Einführung zufälliger Eckstarts erreicht der Spieler Stage 21 ohne größere Probleme, besonders durch Startressourcen und Scans/Reinforcements/Orbital Strike. Gemeldete Stapel: Supply crate ×8, Aether allocation ×4, Pioneer squad ×3, Commander mandate ×1, Survey drones ×1, Field workshop ×1, Command capacitor ×2. Fraktion und permanente Upgrade-Stufen fehlen noch.

Erste menschliche Rückmeldung nach der Anpassung: „schon viel viel besser“. Neue erreichte Stage, Fraktion und Flottenausstattung sind noch nicht angegeben; daraus folgt noch keine Abnahme tiefer Runs.

Mit einem neuen Run prüfen, ob halbierte Supply crates, geringere Startenergie, Technologie-/Zielbedingungen der Fähigkeiten und gegnerische Vorteilsstapel genügend Gegenwehr erzeugen, ohne den Einstieg ohne Flottenupgrades zu überfordern. Insbesondere frühe gegnerische Commander-/Worker-Vorteile und mehrere Parteien mit vielen Ressourcenstapeln vergleichen. Die aktuellen Regeln stehen ausschließlich in den [Spielregeln](../gameplay.md); weitere Zahlenänderungen erst aus dem nächsten menschlichen Run ableiten.

## Sehr tiefe Expeditionen

Der Verhaltensdruck erreicht ab Tiefe 16 seine letzte Stufe; unbegrenzte Ressourcen-Vorteile wachsen bei Spieler und Gegner-Slots weiter. Ob die begrenzten Workerziele und Produktionspläne der KI ihre zusätzlichen Startmittel in sehr tiefen Runs ausreichend nutzen, bleibt offen. Erst nach erneuten menschlichen Runs weitere Verhaltensstufen, Vorteilsgrenzen oder zusätzliche Produktionskapazität entscheiden; keine heimlichen Ressourcen- oder Kampfwertboni ergänzen.

## Permanenter Start-Aether

Ein permanentes Upgrade für Start-Aether bleibt zurückgestellt: Die bestehende Evakuierung überträgt auch ungenutzten Start-Aether in die Metawährung. Das gilt bereits für den Run-Vorteil Aether allocation und wurde nicht nebenbei geändert. Ein permanentes Start-Aether-Upgrade könnte ohne eigene Förderung wiederholt Reserve erzeugen. Vor einer Umsetzung entscheiden, ob Evakuierung an Förderung gebunden oder Start-Aether getrennt verrechnet werden soll; keine pauschale Änderung der bestehenden Auszahlung ohne Auftrag.

## Weitere Kandidaten, noch keine Umsetzungsvorgabe

Fortification kit, Veteran cadre, Emergency logistics, Salvage protocol und Commander recovery erst nach Bewertung des jetzigen Vorteilspakets konkretisieren. Für jeden Kandidaten sind Stapelgrenze, Verbrauch pro Gefecht, Bezahlung, Erstattung und Versorgung festzulegen. Mehrere koordinierte KI-Kampfgruppen sind ebenfalls kein Teil des jetzigen Ein-Gruppen-Piloten.
