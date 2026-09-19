# Höhenstufen 4: Sichtvorteil für Hochplateaus

## Auftrag und Reihenfolge

Nach dem ersten positiven Nutzertest des Mothership-Prototyps ist dies der nächste Umsetzungsschritt auf `experiment/hoehenstufen`. Zunächst ausschließlich Sicht korrigieren; weitere Kartenumbauten und andere Höhenvorteile zurückstellen. [Gesamtstand und Teststart](README.md).

## Festgelegte Regel

- Bodengebundene Sichtquellen im Tiefland dürfen ein höheres Plateau nicht aufdecken.
- Vom Plateau darf das tiefere Gelände innerhalb der bestehenden Sichtreichweite aufgedeckt werden. Keine zusätzliche Sichtreichweite als Bonus.
- Die Regel gilt für beide Parteien gleichermaßen. Sie muss tatsächliche Sicht und Aufdeckung begrenzen, nicht nur die Nebeldarstellung.
- Kein zusätzlicher Schaden, keine Treffer-/Ausweichboni, keine Reichweitenänderung und keine neue physische Schussblockierung. Bestehende Abhängigkeiten von Zielsicht bleiben erhalten; sie sind kein neuer Kampfbonus.
- Keine vollständige Übernahme der StarCraft-Regeln: Nur der ausdrücklich gewünschte asymmetrische Sichtvorteil ist entschieden.

## Vor Umsetzung konkretisieren

- Rampen: Ab welchem Übergang gilt ein Beobachter als auf dem Plateau? Nicht jeden kleinen Höhenunterschied zwischen Dreiecken als eigene Sichtstufe behandeln.
- Sicht über dazwischenliegendes Hochgelände auf ein dahinterliegendes Tiefland: Endpunkthöhen allein definieren noch keine allgemeine Gelände-Sichtlinie. Nicht unbeabsichtigt ein größeres Occlusion-System einführen.
- Flugzeuge, Scan und andere temporäre Sichtquellen: bestehende Sonderfälle prüfen und ihre Behandlung ausdrücklich festlegen, keine SC2-Ausnahmen stillschweigend übernehmen.
- Gebäudehöhe und kosmetische Schwebe-/Modelloffsets sind nicht automatisch eine erhöhte Sichtstufe.

## Umsetzung und Akzeptanz

- [ ] Gemeinsame autoritative Sichtberechnung um den Höhenvertrag ergänzen; vorhandene CPU-Oberfläche verwenden, keine unabhängige Renderer-Höhenlogik.
- [ ] Aktuelle Sicht von dauerhaft erkundetem Terrain unterscheiden: Ein noch unbekanntes Plateau darf von unten nicht erkundet werden. Bereits erkundetes Gelände bleibt bekannt, ohne dadurch aktuelle Feindpositionen preiszugeben.
- [ ] Sichtquellen derselben Partei korrekt vereinigen: Ein eigener Beobachter oben kann Sicht liefern, auch wenn eine andere eigene Einheit unten steht. Nach Wegfall der oberen Quelle keine veraltete Sicht behalten.
- [ ] Fog, Minimap, Auswahl/Zielzugriff und KI verwenden den gleichen resultierenden Sichtzustand. Multiplayer-Entitäten und Ereignisse serverseitig filtern; private Startzuordnung weiter schützen.
- [ ] Kurze deterministische Tests: unten nach oben gesperrt, oben nach unten innerhalb der Reichweite sichtbar, gleiche Ebene unverändert, Rampenauf-/abstieg, mehrere Sichtquellen, Sichtverlust und erkundeter Speicher; beschlossene Luft-/Scan-Regeln ergänzen.
- [ ] Unveränderte Flachkarten sowie Server-Sichtfilter gezielt prüfen. Standardtests durch den Hauptagenten zum Abschluss; KI-/Simulations-Langläufe weiterhin nur nach ausdrücklicher Nutzerfreigabe.
- [ ] Menschlicher Test an beiden Seiten derselben Klippe und an einer Rampe, bevor weitere Karten adaptiert werden.

Noch nicht implementiert. Technische Nachweise des bisherigen Prototyps prüfen weiterhin planare Sicht und gelten nicht als Abnahme dieser Änderung.
